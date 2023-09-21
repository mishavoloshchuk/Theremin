// Get references to HTML elements 
const playButton = document.getElementById("playButton");
const stopButton = document.getElementById("stopButton");
const frequencyLabel = document.getElementById("frequencyLabel");

let audioAllowed = false;

// Constants
const DEFAULT_AUDIO_ID = 0;

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

	#adjustVolume(){
		this.globalGain.gain.linearRampToValueAtTime(this.globalVolume / Math.max(1, this.activeOscillators), this.audioContext.currentTime + this.RELEASE_TIME);
	}
}

class Cursor {
	// Enum constants
	static DOWN = true;
	static UP = false;
	static LEFT = 1;
	static MIDDLE = 2;
	static RIGHT = 3;

	constructor(){
		Object.assign(this, {
			posX: 0,
			posY: 0,
			normX: 0,
			normY: 0,
			leftDown: false,
		});

		window.addEventListener('mousemove', (e) => {
			this.posX = e.clientX;
			this.posY = e.clientY;

			this.normX = this.posX / innerWidth;
			this.normY = this.posY / innerHeight;
		});

		window.addEventListener('mousedown', (e) => { 
			switch (e.which){
			case Cursor.LEFT:
				this.leftDown = Cursor.DOWN;
				break;
			}
		});

		window.addEventListener('mouseup', (e) => { 
			switch (e.which){
			case Cursor.LEFT: "value", 
				this.leftDown = Cursor.UP;
				break;
			}
		});

		window.addEventListener('touchmove', (e) => {
			this.posX = e.targetTouches[0].clientX;
			this.posY = e.targetTouches[0].clientY;

			this.normX = this.posX / innerWidth;
			this.normY = this.posY / innerHeight;
		});

		window.addEventListener('touchstart', (e) => { 
			this.leftDown = Cursor.DOWN;
		});

		window.addEventListener('touchend', (e) => { 
			this.leftDown = Cursor.UP;
		});
	}
}

class DoubleRange {
	constructor(id, options = {}){
		this.wrapper = document.getElementById(id);
		this.rangeMin = this.wrapper.querySelector("input[name='start']");
		this.rangeMax = this.wrapper.querySelector("input[name='end']");

		this.minClosureNorm = options.minClosureNorm || 0;

		this.min = options.min;
		this.max = options.max;

		// Set initial values
		this.startNorm = options.initStart ? this.#absConvert(options.initStart) : 0;
		this.endNorm =options.initEnd ? this.#absConvert(options.initEnd) : 1;
		this.rangeMin.setAttribute('value', this.startNorm);
		this.rangeMax.setAttribute('value', this.endNorm);


		this.startAbs = options.initStart || options.max;
		this.endAbs = options.initEnd || options.max;

		this.wrapper.addEventListener('input', (e) => {
			const input = e.target;
			if (input.getAttribute('name') === 'start'){
				this.#startInput(e);
			} else {
				this.#endInput(e);
			}

			options.oninput && options.oninput(this.startAbs, this.endAbs, e);
		});

		this.wrapper.addEventListener('change', (e) => {
			options.onchange && options.onchange(this.startAbs, this.endAbs, e);
		});
	}

	#startInput(e){
		const input = e.target;
		if (parseFloat(input.value) + this.minClosureNorm <= +this.rangeMax.value){
			const valAbs = this.#logConvert(parseFloat(input.value));
			this.startAbs = valAbs;
		} else {
			input.value = this.#absConvert(this.endAbs) - this.minClosureNorm;
			this.startAbs = this.#logConvert(parseFloat(input.value));
		}
		this.startNorm = parseFloat(input.value);
	}

	#endInput(e){
		const input = e.target;
		if (parseFloat(this.rangeMin.value) <= parseFloat(input.value) - this.minClosureNorm){
			const valAbs = this.#logConvert(parseFloat(input.value));
			this.endAbs = valAbs;
		} else {
			input.value = this.#absConvert(this.startAbs) + this.minClosureNorm;
			this.endAbs = this.#logConvert(parseFloat(input.value));
		}
		this.endNorm = parseFloat(input.value);
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
		canvas.width = innerWidth;
		canvas.height = innerHeight;
		this.ctx = canvas.getContext('2d');

		this.scaleMin = options.begin || 0;
		this.scaleMax = options.end || 20000;

		this.renderLabels = false;

		window.addEventListener('resize', () => {
			this.canvas.width = innerWidth;
			this.canvas.height = innerHeight;
			this.renderNotes();
		})
	}

	renderNotes(){
		const BASE_FREQUENCY = 13.75; // Music note A frequency
		let frequency = this.scaleMin;
		let note = 0; // Start note
		const blackNotes = [1,4,6,9,11];
		const notesNames = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];

		const BLACK_KEY = "#111";
		const WHITE_KEY = "#888";

		const numNotes = notesCount(this.scaleMin, this.scaleMax);

		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		while (frequency < this.scaleMax) {

			const screenPos = absToLogNormalize(frequency, this.scaleMax, this.scaleMin) * innerWidth;

			this.ctx.beginPath();
			this.ctx.lineWidth = innerWidth / numNotes - 1;
			this.ctx.strokeStyle = blackNotes.includes(note % 12) ? BLACK_KEY : WHITE_KEY;
			this.ctx.moveTo(screenPos, 0);
			this.ctx.lineTo(screenPos, innerHeight);
			this.ctx.stroke();

			if (this.renderLabels){
				this.ctx.save();
				this.ctx.font = "14px monospace";
				this.ctx.fillStyle = blackNotes.includes(note % 12) ? WHITE_KEY : BLACK_KEY;
				this.ctx.translate(screenPos - 5, 10);
				this.ctx.rotate(Math.PI/2);
				this.ctx.fillText(`${notesNames[note%12]}(${frequency.toFixed(1)})`, 0, 0);
				this.ctx.restore();
			}

			note ++;
			frequency = BASE_FREQUENCY * Math.pow(2, note/12);
		}
	}
}

const mouse = new Cursor();

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

// Mouse events ==============
// Mouse DOWN
frequency_picker.addEventListener("mousedown", () => {
	if (!waveGen.isAudioInitializated(0)) waveGen.initAudio(DEFAULT_AUDIO_ID);
	waveGen.playWave(0);
	audioAllowed = true;
});

// Mouse MOVE
frequency_picker.addEventListener("mousemove", (e) => {
	const frequency = getFrequency(mouse.normX);
	waveGen.setFrequency(frequency, 0);
	frequencyLabel.innerHTML = `<div class="frequency_label">${frequency}</div>`;
});

// Mouse UP
window.addEventListener("mouseup", () => {
	waveGen.stopWave(0);
});

// Touch events ===========
// Touch DOWN
frequency_picker.addEventListener("touchstart", (e) => {
	const targetTouch = e.changedTouches[0];
	if (!waveGen.isAudioInitializated(targetTouch.identifier) && targetTouch.identifier > 0) waveGen.initAudio(targetTouch.identifier);
	if (audioAllowed) e.preventDefault();

	// Set frequency
	const frequency = getFrequency(targetTouch.clientX / innerWidth);
	waveGen.setFrequency(frequency, targetTouch.identifier);
	waveGen.playWave(targetTouch.identifier);
});

// Touch MOVE
frequency_picker.addEventListener("touchmove", (e) => {
	e.preventDefault();
	let displayFrequency = "";
	for (const touch of e.touches){
		if (!waveGen.isAudioInitializated(touch.identifier)) return;
		const frequency = getFrequency(touch.clientX / innerWidth);
		waveGen.setFrequency(frequency, touch.identifier);
		displayFrequency += `<span class="frequency_label">${frequency}</span>`;
	}
	frequencyLabel.innerHTML = displayFrequency;
});

// Touch UP
window.addEventListener("touchend", (e) => {
	const targetTouch = e.changedTouches[0];
	if (!waveGen.isAudioInitializated(targetTouch.identifier)) return;
	waveGen.stopWave(targetTouch.identifier);
});

// Touch TAP
frequency_picker.addEventListener("click", (e) => {
	waveGen.initAudio(DEFAULT_AUDIO_ID);
	audioAllowed = true;
});


// Keyboard events
// DOWN
window.addEventListener("keydown", (e) => {
	const keyCode = e.keyCode;
	if (!waveGen.isAudioInitializated(0)) return;
	switch (keyCode){
	case KEY_NAME.space:
		waveGen.playWave(0);
		break;
	}
});
// UP
window.addEventListener("keyup", (e) => {
	const keyCode = e.keyCode;
	if (!waveGen.isAudioInitializated(0)) return;
	switch (keyCode){
	case (KEY_NAME.space):
		waveGen.stopWave(0);
		break;
	}
});

// Volume
volumeSlider.addEventListener('input', () => {
	waveGen.setVolume(volumeSlider.value);
});

// Toggle full screen
document.getElementById('toggle_fullscreen').addEventListener('click', toggleFullScreen);
function toggleFullScreen() {
	if (!document.fullscreenElement) {
		document.documentElement.requestFullscreen();
	} else {
		if (document.exitFullscreen) {
			document.exitFullscreen();
		}
	}
}
function setFullScreenIcon() {
	let fullScreenBtn = document.getElementById("toggle_fullscreen");
	if (document.fullscreenElement) {
		fullScreenBtn.setAttribute('enabled', 'true');
	} else {
		if (document.exitFullscreen) {
			fullScreenBtn.setAttribute('enabled', 'false');
		}
	}
}
document.addEventListener('fullscreenchange', (e) => {
	if (!document.fullscreenElement) {
		e.target.setAttribute('enabled', 'true');
	} else {
		e.target.setAttribute('enabled', 'false');
	}
});

window.addEventListener('resize', function (){
	setFullScreenIcon(); // Check full screen mode and set the button icon
});

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
	return Math.round(semitonesInOctave * Math.log2(f2 / f1));
}

function absToNorm(val, max, min){
	return (val - min) / (max - min);
}
