// Get references to HTML elements 
const playButton = document.getElementById("playButton");
const stopButton = document.getElementById("stopButton");
const frequencyLabel = document.getElementById("frequencyLabel");

let audioAllowed = false;

class WaveGenerator {
	// Constants
	get ATTACK_TIME () { return 0.01; }
	get RELEASE_TIME () { return 0.1; }

	constructor(){
		// Initialize the AudioContext
		this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

		this.globalVolume = volumeSlider.value;

		// Global volume control
		this.globalGain = this.audioContext.createGain();
		this.globalGain.connect(this.audioContext.destination);

		this.activeOscillators = 0;

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
		this.globalGain.gain.setValueAtTime(this.globalVolume / Math.max(1, this.activeOscillators), this.audioContext.currentTime);
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

const mouse = new Cursor();

const waveGen = new WaveGenerator();

// Mouse events ==============
// Mouse DOWN
frequency_picker.addEventListener("mousedown", () => {
	if (!waveGen.isAudioInitializated(0)) waveGen.initAudio(0);
	waveGen.playWave(0);
	audioAllowed = true;
});

// Mouse MOVE
frequency_picker.addEventListener("mousemove", (e) => {
	const frequency = getFrequency(mouse.normX);
	waveGen.setFrequency(frequency, 0);
	frequencyLabel.innerHTML = frequency;
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
		displayFrequency += frequency.toFixed(2) + "<br>";
	}
	frequencyLabel.innerHTML = displayFrequency;
});

// Touch UP
window.addEventListener("touchend", (e) => {
	const targetTouch = e.changedTouches[0];
	if (audioAllowed) e.preventDefault();
	if (!waveGen.isAudioInitializated(targetTouch.identifier)) return;
	waveGen.stopWave(targetTouch.identifier);
});

// Touch TAP
window.addEventListener("click", (e) => {
	e.preventDefault();
	waveGen.initAudio(0);
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

// Convert a normalized value to logarithmic value
function normalizeToLog(normalizedValue, maxValue, minValue = 0) {
	// Ensure the normalized value is within [0, 1]
	normalizedValue = Math.min(1, Math.max(0, normalizedValue));

	const logMin = Math.log(minValue);
	const logMax = Math.log(maxValue);

	// Convert the normalized value to the logarithmic range
	const logValue = logMin + normalizedValue * (logMax - logMin);

	// Convert it back to the original range
	const originalValue = Math.exp(logValue);

	return originalValue;
}

function getFrequency(value){
	return +normalizeToLog(parseFloat(value), 20000, 20).toFixed(2);
}
