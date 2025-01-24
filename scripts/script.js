// Get references to HTML elements 
const playButton = document.getElementById("playButton");
const stopButton = document.getElementById("stopButton");
const frequencyLabel = document.getElementById("frequencyLabel");

// Constants
const DEBUG_MODE = false;

const DEFAULT_AUDIO_ID = 0;

// Animation
Element.prototype.show = function (){
	if (this.getAttribute('animState') !== "hidden" && this.getAttribute('animState') !== null) return;
	const animDuration = this.getAttribute('animationDuration');
	this.setAttribute('animState', 'showing');
	clearTimeout(this.timeout);
	this.timeout = setTimeout(() => {this.setAttribute('animState', 'showed');}, animDuration);
}
Element.prototype.hide = function (){
	if (this.getAttribute('animState') !== "showed" && this.getAttribute('animState') !== null) return;
	const animDuration = this.getAttribute('animationDuration');
	this.setAttribute('animState', 'hiding');
	clearTimeout(this.timeout);
	this.timeout = setTimeout(() => {this.setAttribute('animState', 'hidden');}, animDuration);
}

class ToneConverter {
	static BASE_FREQUENCY = 13.75; // Music note A frequency
	static OCTAVE = 12;

	static TONE_NAMES = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];

	/**
	 * @frequency Is input frequency
	 * @toneShift Shift the frequency by the specified tone value
	 * @toneShift 1/-1/0.5 is +1/-1/+0.5 tone to frequency
	**/
	static getToneNearFrequency(frequency, toneShift = 0) { 
		const exactTone = this.getTone(frequency);
		const tone = Math.round(exactTone);
		const freqOut = this.BASE_FREQUENCY * Math.pow(2, (tone + toneShift) / this.OCTAVE);
		return freqOut;
	}

	/**
	 * @return Tone relative to BASE_FREQUENCY based on specified frequency
	 **/
	static getTone(frequency){
		return Math.log2(frequency / this.BASE_FREQUENCY) * this.OCTAVE;
	}

	static getToneName(frequency){
		const tone = Math.round(this.getTone(frequency));
		return this.TONE_NAMES[tone % this.OCTAVE];
	}
}

class WaveGenerator {
	// Constants
	get ATTACK_TIME () { return 0.01; }
	get RELEASE_TIME () { return 0.1; }

	constructor(options){
		// Initialize the AudioContext
		this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

		this.globalVolume = volumeSlider.value;

		// Global volume control
		this.globalGain = this.audioContext.createGain();
		this.globalGain.connect(this.audioContext.destination);

		this.activeOscillators = 0;

		this.min = 20;
		this.max = 20000;

		Object.assign(this, options);

		this.oscillators = new Array();
	}

	initAudio(oscillatorId){
		if (this.oscillators[oscillatorId]) return;

		// Create a gain node
		const gainNode = this.audioContext.createGain();
		// Connect the gain node to the audio output
		gainNode.connect(this.globalGain);

		// Create an oscillator node
		const oscillatorNode = this.audioContext.createOscillator();
		// Connect the oscillator to the gain node
		oscillatorNode.connect(gainNode);

		this.oscillators[oscillatorId] = {
			gain: gainNode,
			oscillator: oscillatorNode
		};

		// Set initial oscillator frequency
		this.setFrequency(getFrequency(0.5), oscillatorNode);
		oscillatorNode.start();
		gainNode.gain.value = 0;
	}

	isAudioInitializated(oscillatorId){
		return !!this.oscillators[oscillatorId];
	}

	// Function to play the wave
	playWave(oscillatorId) {
		const entry = this.oscillators[oscillatorId];
		if (!entry) return;
		if (entry.gain.gain.value === 1) return;

		const gainNode = entry.gain;

		// Gradually decrease the gain to 1
		gainNode.gain.cancelAndHoldAtTime(this.audioContext.currentTime);
		gainNode.gain.setValueAtTime(gainNode.gain.value, this.audioContext.currentTime);
		gainNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + this.ATTACK_TIME);
		this.activeOscillators ++;
		// Adjust volume
		this.#adjustVolume();
	}

	// Function to stop the wave
	stopWave(oscillatorId) {
		const entry = this.oscillators[oscillatorId];
		if (!entry) return;
		if (entry.gain.gain.value === 0) return;

		const gainNode = entry.gain;

		// Gradually decrease the gain to 0
		gainNode.gain.cancelAndHoldAtTime(this.audioContext.currentTime);
		gainNode.gain.setValueAtTime(gainNode.gain.value, this.audioContext.currentTime);
		gainNode.gain.linearRampToValueAtTime(0.0, this.audioContext.currentTime + this.RELEASE_TIME);
		this.activeOscillators = Math.max(0, this.activeOscillators - 1);
		// Adjust volume
		this.#adjustVolume();
	}

	setFrequency(frequency, oscillatorId){
		if (!this.oscillators[oscillatorId]) return;
		const oscillatorNode = this.oscillators[oscillatorId].oscillator;
		oscillatorNode.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
	}

	setVolume(vol){
		this.globalVolume = vol;
		this.globalGain.gain.setValueAtTime(vol / Math.max(1, this.activeOscillators), this.audioContext.currentTime);
	}

	#prevOscillatorsCount = 0;
	#adjustVolume(){
		const linearRampSpeed = (this.#prevOscillatorsCount < this.activeOscillators) ? this.ATTACK_TIME : this.RELEASE_TIME;

		// Set adjusted gain
		this.globalGain.gain.cancelAndHoldAtTime(this.audioContext.currentTime);
		this.globalGain.gain.setValueAtTime(this.globalGain.gain.value, this.audioContext.currentTime);
		this.globalGain.gain.linearRampToValueAtTime(this.globalVolume / Math.max(1, this.activeOscillators), this.audioContext.currentTime + linearRampSpeed);

		this.#prevOscillatorsCount = this.activeOscillators;
	}
}

class DoubleRange {
	constructor(id, options = {}){
		this.wrapper = document.getElementById(id);
		this.rangeMin = this.wrapper.querySelector("input[name='start']");
		this.rangeMax = this.wrapper.querySelector("input[name='end']");
		this.rangeMove = this.wrapper.querySelector("span[name='move']");

		// Constants for event listener names
		const INPUT_EVENT = 'input';
		const CHANGE_EVENT = 'change';

		// Constants for min and max values
		const DEFAULT_MIN = 0;
		const DEFAULT_MAX = 1;

		// Set default values if not provided in options
		this.minClosureNorm = options.minClosureNorm || 0;
		this.min = options.min;
		this.max = options.max;

		// Set initial values
		this.startNorm = options.initStart ? this.#absConvert(options.initStart) : DEFAULT_MIN;
		this.endNorm =options.initEnd ? this.#absConvert(options.initEnd) : DEFAULT_MAX;
		this.rangeMin.setAttribute('value', this.startNorm);
		this.rangeMax.setAttribute('value', this.endNorm);
		this.oninput = options.oninput;
		this.#updateMiddleRange();

		this.startAbs = options.initStart || options.max;
		this.endAbs = options.initEnd || options.max;

		this.wrapper.addEventListener(INPUT_EVENT, (e) => {
			const input = e.target;
			switch (input.getAttribute('name')){
			case 'start':
				this.#startInput(e);
				break;
			case 'move':
				this.#moveInput(e);
				break;
			case 'end':
				this.#endInput(e);
				break;
			}
			this.#updateMiddleRange();

			this.oninput && this.oninput(this.startAbs, this.endAbs, e);
		});

		this.#initMoveThumb();
	}

	#isInputMoveThumb = false;
	#mousePrevPos;
	#initMoveThumb(){
		const MOUSE_DOWN_EVENT = 'mousedown';
		const MOUSE_MOVE_EVENT = 'mousemove';
		const MOUSE_UP_EVENT = 'mouseup';

		const TOUCH_START_EVENT = 'touchstart';
		const TOUCH_MOVE_EVENT = 'touchmove';
		const TOUCH_END_EVENT = 'touchend';

		const downEventHandler = (e) => {
			// Event X position depending on device
			const posX = e.type === MOUSE_DOWN_EVENT ? e.clientX : e.targetTouches[0].clientX;

			this.#isInputMoveThumb = true;
			this.#mousePrevPos = posX;
		}

		const moveEventHandler = (e) => {
			if (!this.#isInputMoveThumb) return;

			// Event X position depending on device
			const posX = e.type === MOUSE_MOVE_EVENT ? e.clientX : e.targetTouches[0].clientX;

			// Calculate the movement and update the input thumb position
			this.#moveInput((posX - this.#mousePrevPos)/innerWidth);
			this.#mousePrevPos = posX;

			// Trigger the oninput callback if defined
			this.oninput && this.oninput(this.startAbs, this.endAbs, e);
		}

		const upEventHandler = (e) => {
			this.#isInputMoveThumb = false;
		}

		// Set mouse event listeners
		this.rangeMove.addEventListener(MOUSE_DOWN_EVENT, downEventHandler);
		document.addEventListener(MOUSE_MOVE_EVENT, moveEventHandler);
		document.addEventListener(MOUSE_UP_EVENT, upEventHandler);

		// Set touch event listeners
		this.rangeMove.addEventListener(TOUCH_START_EVENT, downEventHandler, {passive: false});
		document.addEventListener(TOUCH_MOVE_EVENT, moveEventHandler, {passive: false});
		document.addEventListener(TOUCH_END_EVENT, upEventHandler, {passive: false});
	}

	#startInput(){
		const input = this.rangeMin;
		if (parseFloat(input.value) + this.minClosureNorm <= +this.rangeMax.value){
			const valAbs = this.#logConvert(parseFloat(input.value));
			this.startAbs = valAbs;
		} else {
			input.value = this.#absConvert(this.endAbs) - this.minClosureNorm;
			this.startAbs = this.#logConvert(parseFloat(input.value));
		}
		this.startNorm = parseFloat(input.value);
	}

	#moveInput(moveValue){
		this.rangeMin.value = parseFloat(this.rangeMin.value) + moveValue;
		this.rangeMax.value = parseFloat(this.rangeMax.value) + moveValue;
		this.#startInput();
		this.#endInput();
		this.#updateMiddleRange();
	}

	#endInput(){
		const input = this.rangeMax;
		if (parseFloat(this.rangeMin.value) <= parseFloat(input.value) - this.minClosureNorm){
			const valAbs = this.#logConvert(parseFloat(input.value));
			this.endAbs = valAbs;
		} else {
			input.value = this.#absConvert(this.startAbs) + this.minClosureNorm;
			this.endAbs = this.#logConvert(parseFloat(input.value));
		}
		this.endNorm = parseFloat(input.value);
	}

	#updateMiddleRange(){
		const newValue = (this.startNorm + this.endNorm) / 2;
		this.rangeMove.style.left = (this.rangeMin.value * 100) + "%";
		this.rangeMove.style.right = (100 - this.rangeMax.value * 100) + "%";
	}

	#absConvert(value){
		return absToLogNormalize(value, this.max, this.min);
	}

	#logConvert(value){
		return normalizeToLog(parseFloat(value), this.max, this.min)
	}
}

class LogGrid {
	constructor(canvas, options = {}){
		this.canvas = canvas;
		this.#setCanvasSize();
		this.ctx = canvas.getContext('2d');

		this.scaleMin = options.begin || 0;
		this.scaleMax = options.end || 20000;

		this.renderLabels = false;

		window.addEventListener('resize', () => {
			this.#setCanvasSize();
			this.renderNotes();
		});
	}

	#setCanvasSize() {
		const compHeight = parseFloat(getComputedStyle(this.canvas).getPropertyValue('height'));
		this.canvas.setAttribute('width', innerWidth);
		this.canvas.setAttribute('height', compHeight);
	}

	renderNotes(){
		const BLACK_KEY = "#111";
		const WHITE_KEY = "#888";

		const numNotes = notesCount(this.scaleMin, this.scaleMax);

		let frequency = this.scaleMin;
		let note = 0; // Start note
		const blackNotes = [1,4,6,9,11];

		const separationLineWidth = 1;

		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		while (ToneConverter.getToneNearFrequency(frequency, +0.5) < this.scaleMax) {
			note ++;
			frequency = ToneConverter.BASE_FREQUENCY * Math.pow(2, note / ToneConverter.OCTAVE);

			if (ToneConverter.getToneNearFrequency(frequency, 0.5) < this.scaleMin) continue;

			const screenPos = absToLogNormalize(frequency, this.scaleMax, this.scaleMin) * innerWidth;

			this.ctx.beginPath();
			this.ctx.lineWidth = innerWidth / numNotes - separationLineWidth;
			this.ctx.strokeStyle = blackNotes.includes(note % ToneConverter.OCTAVE) ? BLACK_KEY : WHITE_KEY;
			this.ctx.moveTo(screenPos, 0);
			this.ctx.lineTo(screenPos, innerHeight);
			this.ctx.stroke();

			if (this.renderLabels){
				this.ctx.save();
				this.ctx.font = "16px monospace";
				this.ctx.fillStyle = blackNotes.includes(note % ToneConverter.OCTAVE) ? WHITE_KEY : BLACK_KEY;
				this.ctx.translate(screenPos - 5, 10);
				this.ctx.rotate(Math.PI/2);
				this.ctx.fillText(`${ToneConverter.TONE_NAMES[note % ToneConverter.OCTAVE]} (${frequency.toFixed(1)})`, 0, 0);
				this.ctx.restore();
			}
		}
	}
}

const dRange = new DoubleRange('doubleRange', {
	min: 20,
	max: 20000,
	initStart: 108,
	initEnd: 5000,
	minClosureNorm: 0.1,
	oninput: (start, end) => {
		grid.scaleMin = waveGen.min = start;
		grid.scaleMax = waveGen.max = end;
		grid.renderNotes();
	}
});
const rangeBackground = new LogGrid(document.getElementById('range_background_canvas'), {begin: dRange.min, end: dRange.max});
rangeBackground.renderNotes();

const waveGen = new WaveGenerator({min: dRange.min, max: dRange.max});

const grid = new LogGrid(document.getElementById('frequency_picker'), {begin: dRange.min, end: dRange.max});
grid.renderLabels = true;
grid.scaleMin = waveGen.min = dRange.startAbs;
grid.scaleMax = waveGen.max = dRange.endAbs;
grid.renderNotes();

function allowAudio() {
	const modal = document.getElementById('audio_permission_modal');
	modal.hide();
	waveGen.initAudio(DEFAULT_AUDIO_ID);
}

function getFrequencyLabel(frequency, x, y, yShift){
	const toneName = ToneConverter.getToneName(frequency);
	const toneError = Math.abs( Math.sin( (ToneConverter.getTone(frequency) ) * Math.PI) );
	const elemHalfWidth = 65; // In px
	const elemHalfHeight = 12;
	let xPos = x + elemHalfWidth > innerWidth ? innerWidth - elemHalfWidth : x;
	xPos = x - elemHalfWidth < 0 ? elemHalfWidth : xPos;

	const canvRect = grid.canvas.getBoundingClientRect();
	let yPos = y + yShift;
	yPos = yPos > canvRect.top + elemHalfHeight ? yPos : canvRect.top + elemHalfHeight;

	const pointPosX = 5 + (ToneConverter.getTone(frequency) - 0.5) % 1 * 90;
	return 	`<div class="frequency_label" 
				style="
			background-color: hsl(215, ${100 - toneError * 100}%, 54%);
			left: ${xPos}px;
			top: ${yPos}px;
			">
				<div class="tone_point" style="left: ${pointPosX}%"></div>
				<span style="display: inline-block; width: 2em;">~${toneName}</span> 
				${frequency}Hz
			</div>`;
}

function drawFrequenciesOnTouch(touches){
	let displayFrequency = "";
	for (const touch of touches){
		if (!waveGen.isAudioInitializated(touch.identifier)) return;
		const frequency = getFrequency(touch.clientX / innerWidth);
		waveGen.setFrequency(frequency, touch.identifier);

		displayFrequency += getFrequencyLabel(frequency, touch.clientX, touch.clientY, -60);
	}
	frequencyLabel.innerHTML = displayFrequency;
}

// Mouse events ==============
// Mouse DOWN
const mouseDownHandler = (e) => {
	DEBUG_MODE && console.log("mousedown");
	waveGen.playWave(DEFAULT_AUDIO_ID);
}


// Mouse MOVE
const mouseMoveHandler = (e) => {
	DEBUG_MODE && console.log("mousemove");
	const frequency = getFrequency(absToNorm(e.clientX, innerWidth, 0));
	waveGen.setFrequency(frequency, DEFAULT_AUDIO_ID);
	frequencyLabel.innerHTML = getFrequencyLabel(frequency, e.clientX, e.clientY, -20);
}

// Mouse UP
const mouseUpHandler = (e) => {
	DEBUG_MODE && console.log("mouseup");
	waveGen.stopWave(DEFAULT_AUDIO_ID);
}

// Touch events ===========
// Touch DOWN
const touchStartHandler = function(e) {
	DEBUG_MODE && console.log("touchstart");
	e.preventDefault();
	const targetTouch = e.changedTouches[0];
	if (!waveGen.isAudioInitializated(targetTouch.identifier) && targetTouch.identifier > 0) waveGen.initAudio(targetTouch.identifier);

	// Set frequency
	const frequency = getFrequency(targetTouch.clientX / innerWidth);
	waveGen.setFrequency(frequency, targetTouch.identifier);
	waveGen.playWave(targetTouch.identifier);

	drawFrequenciesOnTouch(e.touches);
}

// Touch MOVE
const touchMoveHandler = function(e) {
	DEBUG_MODE && console.log("touchmove");
	e.preventDefault();
	drawFrequenciesOnTouch(e.touches);
}

// Touch UP
const touchEndHandler = function(e) {
	DEBUG_MODE && console.log("touchend");
	const targetTouch = e.changedTouches[0];
	if (!waveGen.isAudioInitializated(targetTouch.identifier)) return;
	waveGen.stopWave(targetTouch.identifier);
	frequencyLabel.innerHTML = "";
}


// Mouse event listeners
frequency_picker.addEventListener("mousedown", mouseDownHandler);
frequency_picker.addEventListener("mousemove", mouseMoveHandler);
window.addEventListener("mouseup", mouseUpHandler);
frequencyLabel.addEventListener("mousedown", mouseDownHandler);
frequencyLabel.addEventListener("mousemove", mouseMoveHandler);

// Touch event listeners
frequency_picker.addEventListener("touchstart", touchStartHandler);
frequency_picker.addEventListener("touchmove", touchMoveHandler);
window.addEventListener("touchend", touchEndHandler);


// Keyboard events
// DOWN
window.addEventListener("keydown", (e) => {
	const keyCode = e.keyCode;
	DEBUG_MODE && console.log("keydown", keyCode);
	if (!waveGen.isAudioInitializated(DEFAULT_AUDIO_ID)) return;
	switch (keyCode){
	case KEY_NAME.space:
		waveGen.playWave(DEFAULT_AUDIO_ID);
		break;
	}
});
// UP
window.addEventListener("keyup", (e) => {
	const keyCode = e.keyCode;
	DEBUG_MODE && console.log("keyup", keyCode);
	if (!waveGen.isAudioInitializated(DEFAULT_AUDIO_ID)) return;
	switch (keyCode){
	case (KEY_NAME.space):
		waveGen.stopWave(DEFAULT_AUDIO_ID);
		break;
	}
});

// Volume
volumeSlider.addEventListener('input', () => {
	waveGen.setVolume(volumeSlider.value);
});

class ToggleFullScreen {
	get FULLSCREEN_ON() { return 'true' }
	get FULLSCREEN_OFF() { return 'false' }
	constructor(btnId) {
		this.buttonId = btnId
		this.initEventListeners();
	}

	initEventListeners(){
		document.getElementById(this.buttonId).addEventListener('click', this.toggleFullScreen);

		document.addEventListener('fullscreenchange', (e) => {
			e.target.setAttribute('enabled', document.fullscreenElement ?  this.FULLSCREEN_ON : this.FULLSCREEN_OFF);
		});

		window.addEventListener('resize', this.setFullScreenIcon.bind(this));
	}
	// Toggle full screen
	toggleFullScreen() {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen();
		} else {
			if (document.exitFullscreen) {
				document.exitFullscreen();
			}
		}
	}
	setFullScreenIcon() {
		let fullScreenBtn = document.getElementById(this.buttonId);
		if (document.fullscreenElement) {
			fullScreenBtn.setAttribute('enabled', this.FULLSCREEN_ON);
		} else {
			if (document.exitFullscreen) {
				fullScreenBtn.setAttribute('enabled', this.FULLSCREEN_OFF);
			}
		}
	}
}
const fullScreenButton = new ToggleFullScreen('toggle_fullscreen');


function normalizeToLog(normVal, maxValue, minValue = 1) {
	// Ensure the normVal is within [0, 1]
	normVal = Math.min(1, Math.max(0, normVal));

	return Math.pow(2, normVal * Math.log2(maxValue/minValue) + Math.log2(minValue));
}

function absToLogNormalize(value, maxValue, minValue = 1) {
	// Ensure the min value is within [1, maxValue]
	minValue = Math.min(maxValue, Math.max(minValue, 1));

	return (Math.log2(value/minValue)) / (Math.log2(maxValue / minValue));
}

function getFrequency(normVal){
	return parseFloat(normalizeToLog(parseFloat(normVal), waveGen.max, waveGen.min)).toFixed(2);
}

function notesCount(f1, f2, semitonesInOctave = 12){
	// Розрахунок кількості нот у діапазоні
	return semitonesInOctave * Math.log2(f2 / f1);
}

function absToNorm(val, max, min){
	return (val - min) / (max - min);
}
