const $ = document.querySelector.bind(document);
const { createFFmpeg } = FFmpeg;

const recordingTypeList = {
	1: {
		screen: {
			audio: false,
		},
	},
	2: {
		screen: {
			audio: true,
		},
	},
	3: {
		cam: {
			audio: false,
		},
	},
	4: {
		cam: {
			audio: true,
		},
	},
};

const resolutionOptionList = {
	1: {
		width: 640,
		height: 360,
	},
	2: {
		width: 1280,
		height: 720,
	},
	3: {
		width: 1920,
		height: 1080,
	},
	4: {
		width: 2560,
		height: 1440,
	},
	5: {
		width: 3840,
		height: 2160,
	},
};

let recordingState = false;

function Recorder(stream, options, callback) {
	this.mediaRecoder = new MediaRecorder(stream, options);
	this.recordedChunks = [];

	this.handleDataAvailable = (e) => {
		if (e.data.size > 0) {
			this.recordedChunks.push(e.data);
			console.log('Audio BPS: ' + this.mediaRecoder.audioBitsPerSecond);
			console.log('Video BPS: ' + this.mediaRecoder.videoBitsPerSecond);
			callback(new Blob(this.recordedChunks));
		}
	};

	this.startRecording = () => this.mediaRecoder.start();
	this.stopRecording = () => this.mediaRecoder.stop();

	this.mediaRecoder.ondataavailable = this.handleDataAvailable;
}

async function toLibx264(blob) {
	const ffmpeg = createFFmpeg({ log: true });
	await ffmpeg.load();
	const buffer = await blob.arrayBuffer();
	ffmpeg.FS(
		'writeFile',
		'input.webm',
		new Uint8Array(buffer, 0, buffer.byteLength)
	);
	await ffmpeg.run(
		'-i',
		'input.webm',
		'-c:v',
		'libx264',
		'-preset',
		'ultrafast',
		'-crf',
		'27',
		'output.mp4'
	);
	const output = ffmpeg.FS('readFile', 'output.mp4');
	return new Blob([output.buffer], { type: 'video/mp4' });
}

const fadeOut = (element) => {
	var op = 1; // initial opacity
	var timer = setInterval(function () {
		if (op <= 0.1) {
			clearInterval(timer);
			element.style.display = 'none';
		}
		element.style.opacity = op;
		element.style.filter = 'alpha(opacity=' + op * 100 + ')';
		op -= op * 0.1;
	}, 50);
};

async function downloadBlob(blob) {
	$('#video-processing').classList.toggle('fade');
	const resultBlob = await toLibx264(blob);
	$('#spinner').style.display = 'none';
	$('#processing-text').style.display = 'none';
	$('#complete-text').style.display = 'inline';
	setTimeout(() => {
		$('#video-processing').classList.toggle('fade');
		setTimeout(() => {
			$('#spinner').style.display = '';
			$('#processing-text').style.display = '';
			$('#complete-text').style.display = 'none';
		}, 400);
	}, 2500);
	const url = URL.createObjectURL(resultBlob);
	const a = document.createElement('a');
	a.href = url;
	a.download = new Date().toLocaleString() + '.mp4';
	a.click();
}

(async () => {
	let stream, recorder;
	$('#recording').addEventListener('click', async () => {
		if (!recordingState) {
			const recordingType = recordingTypeList[$('#recording-type').value];
			const resolutionOption =
				resolutionOptionList[$('#resolution-option').value];
			if (recordingType.screen) {
				stream = await navigator.mediaDevices.getDisplayMedia({
					video: resolutionOption,
					audio: recordingType.screen.audio
						? {
								autoGainControl: false,
								echoCancellation: false,
								googAutoGainControl: false,
								noiseSuppression: false,
						  }
						: false,
					frameRate: 30,
				});
			} else {
				stream = await navigator.mediaDevices.getUserMedia({
					video: resolutionOption,
					audio: recordingType.cam
						? {
								autoGainControl: false,
								echoCancellation: false,
								googAutoGainControl: false,
								noiseSuppression: false,
						  }
						: false,
					frameRate: 30,
				});
			}
			recorder = new Recorder(
				stream,
				{
					mimeType: 'video/webm; codecs=vp8',
					audioBitsPerSecond: 128000,
				},
				downloadBlob
			);
			recorder.startRecording();
			const video = $('#streaming');
			video.srcObject = stream;
			video.onloadedmetadata = (e) => video.play();
			$('#recording').classList.add('btn-red');
			$('#recording').textContent = 'Stop Recording';
			recordingState = true;
		} else {
			stream.getTracks().forEach((track) => track.stop());
			recorder.stopRecording();
			$('#recording').classList.remove('btn-red');
			$('#recording').textContent = 'Record Now';
			recordingState = false;
		}
	});
})();
