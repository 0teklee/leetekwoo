// 엔트로피 배경 애니메이션
(() => {
	const canvas = document.getElementById("anim-canvas");
	const gl = canvas.getContext("webgl", { alpha: true }); // 투명 배경 설정

	if (!gl) {
		console.warn("WebGL not supported");
		return;
	}

	// 캔버스 크기를 윈도우 크기로 설정
	const resizeCanvas = () => {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		gl.viewport(0, 0, canvas.width, canvas.height);
	};

	window.addEventListener("resize", resizeCanvas);
	resizeCanvas();

	// 셰이더 소스
	const vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    
    uniform mat4 u_model;
    
    varying vec2 v_texCoord;
    
    void main() {
      gl_Position = u_model * vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `;

	const fragmentShaderSource = `
    precision mediump float;
    
    varying vec2 v_texCoord;
    
    uniform sampler2D u_image;
    uniform float u_alpha;
    uniform float u_aspectRatio;
    
    void main() {
      // 항상 1:1 비율 유지를 위한 텍스처 좌표 조정
      vec2 texCoord = v_texCoord;
      
      vec4 color = texture2D(u_image, texCoord);
      
      // 흰색 부분 투명처리 (r,g,b > 0.9)
      if (color.r > 0.9 && color.g > 0.9 && color.b > 0.9) discard;
      
      // 흰색 실루엣 출력
      gl_FragColor = vec4(1.0, 1.0, 1.0, u_alpha * color.a);
    }
  `;

	// 블렌딩 모드 설정 (투명도 적용)
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	gl.clearColor(0, 0, 0, 0); // 투명 배경

	// 셰이더 컴파일
	const compileShader = (source, type) => {
		const shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);

		// 컴파일 오류 확인
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.error("셰이더 컴파일 오류:", gl.getShaderInfoLog(shader));
			return null;
		}

		return shader;
	};

	// 셰이더 프로그램 생성 및 연결
	const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
	const fragmentShader = compileShader(
		fragmentShaderSource,
		gl.FRAGMENT_SHADER
	);

	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	// 링크 오류 확인
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error("셰이더 프로그램 링크 오류:", gl.getProgramInfoLog(program));
		return;
	}

	gl.useProgram(program);

	// 정점 및 텍스처 좌표 데이터 - 단위 사각형
	const positions = new Float32Array([
		-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
	]);

	const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]);

	// 버퍼 생성 및 데이터 전달
	const positionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

	const positionLocation = gl.getAttribLocation(program, "a_position");
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

	const texCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

	const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
	gl.enableVertexAttribArray(texCoordLocation);
	gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

	// 유니폼 위치 가져오기
	const textureLocation = gl.getUniformLocation(program, "u_image");
	const alphaLocation = gl.getUniformLocation(program, "u_alpha");
	const modelLocation = gl.getUniformLocation(program, "u_model");
	const aspectRatioLocation = gl.getUniformLocation(program, "u_aspectRatio");

	// 이미지 프레임 로드
	const frameCount = 8;
	const frameTextures = [];
	let loadedFrames = 0;

	for (let i = 1; i <= frameCount; i++) {
		const texture = gl.createTexture();
		frameTextures.push(texture);

		const image = new Image();
		image.onload = () => {
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				gl.RGBA,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				image
			);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

			loadedFrames++;
			if (loadedFrames === frameCount) {
				// 모든 프레임이 로드되면 애니메이션 시작
				requestAnimationFrame(render);
			}
		};
		image.src = `images/webgl/frame-${i}.png`;
	}

	// 새 정보 정의
	const birds = [
		{
			position: { x: -0.2, y: 0.9 },
			velocity: { x: 0.9, y: -0.15 },
			scale: 0.12,
			alpha: 0.9,
			animSpeed: 12, // 프레임 속도
			moveSpeed: 1.2, // 이동 속도
		},
		{
			position: { x: 0.4, y: -0.2 },
			velocity: { x: -0.25, y: -0.1 },
			scale: 0.08,
			alpha: 0.5,
			animSpeed: 10,
			moveSpeed: 0.9,
		},
		{
			position: { x: 0.0, y: -0.4 },
			velocity: { x: 0.2, y: 0.25 },
			scale: 0.07,
			alpha: 0.7,
			animSpeed: 20,
			moveSpeed: 2.9,
		},
	];

	// 애니메이션 시작 시간
	const startTime = Date.now();

	// 새 위치 업데이트 함수
	function updateBirds(elapsed) {
		for (const bird of birds) {
			// 위치 업데이트 (각기 다른 속도로)
			bird.position.x += bird.velocity.x * 0.001 * bird.moveSpeed;
			bird.position.y += bird.velocity.y * 0.001 * bird.moveSpeed;

			// 화면 경계에 도달하면 방향 전환
			if (bird.position.x > 1 + bird.scale) {
				bird.position.x = -1 - bird.scale;
			} else if (bird.position.x < -1 - bird.scale) {
				bird.position.x = 1 + bird.scale;
			}

			if (bird.position.y > 1 + bird.scale) {
				bird.position.y = -1 - bird.scale;
			} else if (bird.position.y < -1 - bird.scale) {
				bird.position.y = 1 + bird.scale;
			}

			// 진행 방향에 따른 회전 업데이트 (반전 방지)
			const angle = Math.atan2(bird.velocity.y, bird.velocity.x);
			bird.rotation = angle;

			// 가끔 방향 무작위 변경
			if (Math.random() < 0.002) {
				bird.velocity.x = (Math.random() - 0.5) * 2;
				bird.velocity.y = (Math.random() - 0.5) * 2;
			}
		}
	}

	// 새를 그리는 함수
	function drawBird(bird, currentFrame) {
		// 1:1 비율 유지하면서 회전 및 크기 적용
		const aspectRatio = canvas.width / canvas.height;
		const scale = bird.scale;
		const c = Math.cos(bird.rotation);
		const s = Math.sin(bird.rotation);

		// 모델 행렬 생성 (스케일, 회전, 위치 반영)
		const modelMatrix = new Float32Array([
			scale * c,
			scale * s,
			0,
			0,
			-scale * s,
			scale * c,
			0,
			0,
			0,
			0,
			1,
			0,
			bird.position.x,
			bird.position.y,
			0,
			1,
		]);

		// 유니폼 설정
		gl.uniformMatrix4fv(modelLocation, false, modelMatrix);
		gl.uniform1f(alphaLocation, bird.alpha);
		gl.uniform1f(aspectRatioLocation, aspectRatio);

		// 텍스처 바인딩
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, frameTextures[currentFrame]);
		gl.uniform1i(textureLocation, 0);

		// 그리기
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}

	// 렌더링 루프
	function render() {
		// 경과 시간 계산
		const elapsed = Date.now() - startTime;

		// 캔버스 초기화
		gl.clear(gl.COLOR_BUFFER_BIT);

		// 새 위치 업데이트
		updateBirds(elapsed);

		// 각 새를 그리기
		for (const bird of birds) {
			// 현재 프레임 계산 (animSpeed에 따라 다른 속도로 애니메이션)
			const currentFrameIndex = Math.floor(
				((elapsed * bird.animSpeed) / 1000) % frameCount
			);
			drawBird(bird, currentFrameIndex);
		}

		requestAnimationFrame(render);
	}
})();
