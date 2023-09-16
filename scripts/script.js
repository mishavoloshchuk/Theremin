// Get references to HTML elements 
const playButton = document.getElementById("playButton");
const stopButton = document.getElementById("stopButton");
const frequencyLabel = document.getElementById("frequencyLabel");

let audioInitializated = false;

class WaveGenerator {
	ATTACK_TIME = 0.01;
	RELEASE_TIME = 0.1
	constructor(){
		// Initialize the AudioContext
		this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

		// Create a gain node
		this.gainNode = this.audioContext.createGain();
		// Connect the gain node to the audio output
		this.gainNode.connect(this.audioContext.destination);

		// Create an oscillator node
		this.oscillator = this.audioContext.createOscillator();
		// Connect the oscillator to the gain node
		this.oscillator.connect(this.gainNode);

		this.volume = volumeSlider.value;
	}

	initAudio(oscillatorId){
		if (this.audioInitializated) return;
		this.audioInitializated = true;

		// Set initial oscillator frequency
		this.setFrequency(getFrequency());
		this.oscillator.start();
		this.gainNode.gain.value = 0;
	}

	// Function to play the wave
	playWave(oscillatorId) {
		if (!this.audioInitializated) return;

		// Gradually decrease the gain to 1
		this.gainNode.gain.cancelAndHoldAtTime(this.audioContext.currentTime);
		this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioContext.currentTime);
		this.gainNode.gain.linearRampToValueAtTime(this.volume, this.audioContext.currentTime + this.ATTACK_TIME);
	}

	// Function to stop the wave
	stopWave(oscillatorId) {
		if (!this.audioInitializated) return;

		// Gradually decrease the gain to 0
		this.gainNode.gain.cancelAndHoldAtTime(this.audioContext.currentTime);
		this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioContext.currentTime);
		this.gainNode.gain.linearRampToValueAtTime(0.0, this.audioContext.currentTime + this.RELEASE_TIME);
	}

	setFrequency(frequency){
		if (!this.audioInitializated) return;
		this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
	}

	setVolume(vol){
		this.volume = vol;
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

self.mouse = new Cursor();


const waveGen = new WaveGenerator();

// Mouse events ==============
// Mouse DOWN
frequency_picker.addEventListener("mousedown", () => {
	if (!waveGen.audioInitializated) waveGen.initAudio();
	waveGen.playWave();
});

// Mouse MOVE
frequency_picker.addEventListener("mousemove", () => {
	const frequency = getFrequency();
	waveGen.setFrequency(frequency);
	frequencyLabel.innerHTML = frequency;
});

// Mouse UP
window.addEventListener("mouseup", () => {
	waveGen.stopWave();
});

// Touch events ===========
// Touch DOWN
frequency_picker.addEventListener("touchstart", () => {
	waveGen.playWave();
});

// Mouse MOVE
frequency_picker.addEventListener("touchmove", () => {
	const frequency = getFrequency();
	waveGen.setFrequency(frequency);
	frequencyLabel.innerHTML = frequency;
});

// Touch UP
window.addEventListener("touchend", () => {
	waveGen.stopWave();
});

// Touch TAP
window.addEventListener("click", () => {
	waveGen.initAudio();
});


// Keyboard events
// DOWN
window.addEventListener("keydown", (e) => {
	const keyCode = e.keyCode;
	if (!waveGen.audioInitializated) return;
	switch (keyCode){
	case KEY_NAME.space:
		waveGen.playWave();
		break;
	}
});
// UP
window.addEventListener("keyup", (e) => {
	const keyCode = e.keyCode;
	if (!waveGen.audioInitializated) return;
	switch (keyCode){
	case (KEY_NAME.space):
		waveGen.stopWave();
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

function getFrequency(){
	return normalizeToLog(parseFloat(mouse.normX), 20000, 20).toFixed(2);
}

// Disable the oscillator by default
stopButton.disabled = true;
