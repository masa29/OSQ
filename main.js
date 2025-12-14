/**
 * メインアプリケーション - 鬼教官スクワット
 */

class DrillApp {
    constructor() {
        // 画面要素
        this.screens = {
            start: document.getElementById('start-screen'),
            calibration: document.getElementById('calibration-screen'),
            training: document.getElementById('training-screen'),
            result: document.getElementById('result-screen')
        };

        // UI要素
        this.ui = {
            startBtn: document.getElementById('start-btn'),
            restartBtn: document.getElementById('restart-btn'),
            goalInput: document.getElementById('goal-input'),
            goalMinus: document.getElementById('goal-minus'),
            goalPlus: document.getElementById('goal-plus'),
            calibrationProgress: document.getElementById('calibration-progress'),
            progressText: document.getElementById('progress-text'),
            calibrationText: document.getElementById('calibration-text'),
            calibrationStatus: document.getElementById('calibration-status'),
            calibrationTimer: document.getElementById('calibration-timer'),
            fullbodyOverlay: document.getElementById('fullbody-overlay'),
            sergeantFace: document.getElementById('sergeant-face'),
            messageText: document.getElementById('message-text'),
            currentCount: document.getElementById('current-count'),
            goalDisplay: document.getElementById('goal-display'),
            depthFill: document.getElementById('depth-fill'),
            resultMessage: document.getElementById('result-message'),
            finalCount: document.getElementById('final-count'),
            resultDeep: document.getElementById('result-deep'),
            resultMedium: document.getElementById('result-medium'),
            resultShallow: document.getElementById('result-shallow'),
            // 新しいテンポ表示
            tempoCircle: document.getElementById('tempo-circle'),
            tempoBeatNumber: document.getElementById('tempo-beat-number'),
            tempoDisplay: document.getElementById('tempo-display'),
            // 追加訓練
            extraTrainingOverlay: document.getElementById('extra-training-overlay'),
        };

        // カメラ・キャンバス要素
        this.elements = {
            video: document.getElementById('video'),
            poseCanvas: document.getElementById('pose-canvas'),
            previewVideo: document.getElementById('preview-video'),
            previewCanvas: document.getElementById('preview-canvas'),
            trainingCanvas: document.getElementById('training-canvas')
        };

        // コンポーネント
        this.poseDetector = null;
        this.sergeant = null;

        // 状態
        this.currentScreen = 'start';
        this.goal = 20;

        this.init();
    }

    /**
     * 初期化
     */
    init() {
        // イベントリスナー
        this.ui.startBtn.addEventListener('click', () => this.startCalibration());
        this.ui.restartBtn.addEventListener('click', () => this.restart());
        
        // 目標入力
        this.ui.goalMinus.addEventListener('click', () => {
            const current = parseInt(this.ui.goalInput.value) || 20;
            this.ui.goalInput.value = Math.max(5, current - 5);
        });
        
        this.ui.goalPlus.addEventListener('click', () => {
            const current = parseInt(this.ui.goalInput.value) || 20;
            this.ui.goalInput.value = Math.min(100, current + 5);
        });

        // ウィンドウリサイズ対応
        window.addEventListener('resize', () => this.handleResize());
    }

    /**
     * 画面を切り替え
     */
    showScreen(screenName) {
        Object.keys(this.screens).forEach(name => {
            this.screens[name].classList.remove('active');
        });
        this.screens[screenName].classList.add('active');
        this.currentScreen = screenName;
    }

    /**
     * キャリブレーション開始
     */
    async startCalibration() {
        this.goal = parseInt(this.ui.goalInput.value) || 20;
        this.showScreen('calibration');

        // ポーズ検出器を初期化
        this.poseDetector = new PoseDetector();

        // コールバック設定
        this.poseDetector.onFullBodyStatus = (isFullBody, missingParts) => {
            if (isFullBody) {
                this.ui.fullbodyOverlay.classList.add('hidden');
            } else {
                this.ui.fullbodyOverlay.classList.remove('hidden');
                const hasLegIssue = missingParts.some(part => 
                    part.includes('膝') || part.includes('足首')
                );
                this.ui.fullbodyOverlay.querySelector('p').textContent = 
                    hasLegIssue ? '足元を映せ！' : '全身を映せ！';
            }
        };

        this.poseDetector.onCalibrationProgress = (progress, isCorrectPose, reason, countdown) => {
            this.ui.calibrationProgress.style.width = `${progress}%`;
            this.ui.progressText.textContent = `${Math.round(progress)}%`;

            if (reason === 'waiting') {
                this.ui.calibrationStatus.innerHTML = `
                    <div class="status-icon">⏳</div>
                    <div class="status-text">準備中...</div>
                `;
                this.ui.calibrationTimer.textContent = countdown;
                this.ui.calibrationText.textContent = '全身が映った！準備しろ！';
            } else if (isCorrectPose) {
                this.ui.calibrationStatus.innerHTML = `
                    <div class="status-icon">✅</div>
                    <div class="status-text">よし！その姿勢をキープ！</div>
                `;
                this.ui.calibrationTimer.textContent = '';
                this.ui.calibrationText.textContent = '直立姿勢を維持しろ！';
            } else if (reason === 'not_standing') {
                this.ui.calibrationStatus.innerHTML = `
                    <div class="status-icon">🧍</div>
                    <div class="status-text">まっすぐ立て！</div>
                `;
                this.ui.calibrationTimer.textContent = '';
                this.ui.calibrationText.textContent = '膝を伸ばして直立しろ！';
            } else {
                this.ui.calibrationStatus.innerHTML = `
                    <div class="status-icon">🔍</div>
                    <div class="status-text">検出中...</div>
                `;
                this.ui.calibrationTimer.textContent = '';
            }
        };

        this.poseDetector.onCalibrationComplete = () => {
            this.ui.calibrationStatus.innerHTML = `
                <div class="status-icon">💪</div>
                <div class="status-text">準備完了！</div>
            `;
            
            setTimeout(() => this.startTraining(), 1000);
        };

        try {
            await this.poseDetector.initialize(
                this.elements.video,
                this.elements.poseCanvas
            );
        } catch (error) {
            console.error('カメラの初期化に失敗:', error);
            alert('カメラへのアクセスを許可しろ！');
            this.showScreen('start');
        }
    }

    /**
     * トレーニング開始
     */
    startTraining() {
        this.showScreen('training');

        // UI初期化
        this.ui.currentCount.textContent = '0';
        this.ui.goalDisplay.textContent = this.goal;
        this.ui.messageText.textContent = '準備はいいか！';
        this.ui.extraTrainingOverlay.classList.remove('active');
        this.isExtraTraining = false;
        
        // テンポ表示リセット
        this.ui.tempoBeatNumber.textContent = '1';
        const dots = document.querySelectorAll('.beat-dot');
        dots.forEach(dot => dot.classList.remove('active', 'current'));

        // プレビュー設定
        this.elements.previewVideo.srcObject = this.elements.video.srcObject;
        this.setupPreviewCanvas();

        // 鬼教官を初期化
        this.sergeant = new DrillSergeant();
        this.sergeant.setGoal(this.goal);

        // 教官のコールバック設定
        this.sergeant.onMessage = (message) => {
            this.showMessage(message);
        };

        this.sergeant.onBeat = (beat, isStrong) => {
            // テンポ表示を更新（9拍で1スクワット）
            const beatInBar = ((beat - 1) % 9) + 1;
            this.ui.tempoBeatNumber.textContent = beatInBar;
            
            // 円のアニメーション
            this.ui.tempoCircle.classList.remove('beat', 'strong-beat');
            void this.ui.tempoCircle.offsetWidth; // リフロー
            this.ui.tempoCircle.classList.add(isStrong ? 'strong-beat' : 'beat');
            
            // ドットの更新
            const dots = document.querySelectorAll('.beat-dot');
            dots.forEach((dot, index) => {
                dot.classList.remove('active', 'current');
                if (index < beatInBar) {
                    dot.classList.add('active');
                }
                if (index === beatInBar - 1) {
                    dot.classList.add('current');
                }
            });
            
            // アニメーション終了後にクラスを削除
            setTimeout(() => {
                this.ui.tempoCircle.classList.remove('beat', 'strong-beat');
            }, 200);
        };

        this.sergeant.onExtraTraining = () => {
            // 追加訓練モードを有効化
            this.ui.extraTrainingOverlay.classList.add('active');
            
            // 背景色を変更
            this.isExtraTraining = true;
        };

        this.sergeant.onFinish = (count, message) => {
            setTimeout(() => this.showResult(count, message), 1000);
        };

        // ポーズ検出コールバックを更新
        this.poseDetector.onSquatComplete = (count, depthCategory, depth) => {
            // 終了後は無視
            if (this.sergeant.isFinished) return;
            
            this.ui.currentCount.textContent = count;
            
            // 教官に報告
            this.sergeant.handleSquatComplete(count, depthCategory, depth);
            
            // 浅い時は顔を怒らせる
            if (depthCategory === 'shallow') {
                this.shakeFace();
            }
            
        };

        this.poseDetector.onPoseDetected = (state) => {
            // 深さインジケーター更新
            this.ui.depthFill.style.height = `${state.squatDepth * 100}%`;
        };

        // 背景キャンバスの設定
        this.setupTrainingCanvas();

        // カウントダウン後に開始
        this.startCountdown();
    }

    /**
     * カウントダウン
     */
    startCountdown() {
        const messages = this.sergeant.messages.countdown;
        let index = 0;
        
        const showNext = () => {
            if (index < messages.length) {
                const msg = messages[index];
                this.showMessage(msg);
                this.sergeant.speakCountdown(msg);
                index++;
                
                if (index < messages.length) {
                    setTimeout(showNext, 1000);
                } else {
                    // カウントダウン終了、トレーニング開始
                    setTimeout(() => {
                        this.sergeant.start();
                    }, 500);
                }
            }
        };
        
        showNext();
    }

    /**
     * メッセージを表示
     */
    showMessage(message) {
        this.ui.messageText.textContent = message;
        this.ui.messageText.style.animation = 'none';
        setTimeout(() => {
            this.ui.messageText.style.animation = 'pulse 0.3s ease-out';
        }, 10);
    }

    /**
     * 顔を揺らす
     */
    shakeFace() {
        const face = this.ui.sergeantFace.querySelector('.face-emoji');
        face.classList.add('angry');
        setTimeout(() => {
            face.classList.remove('angry');
        }, 300);
    }

    /**
     * プレビューキャンバスの設定
     */
    setupPreviewCanvas() {
        const video = this.elements.previewVideo;
        const canvas = this.elements.previewCanvas;
        const ctx = canvas.getContext('2d');

        const drawPreview = () => {
            if (this.currentScreen !== 'training') return;

            canvas.width = video.videoWidth || 320;
            canvas.height = video.videoHeight || 240;

            if (this.poseDetector && this.poseDetector.latestLandmarks) {
                const landmarks = this.poseDetector.latestLandmarks;
                const width = canvas.width;
                const height = canvas.height;

                // 顔をマスク
                this.drawFaceMaskOnPreview(landmarks, ctx, width, height);

                const connections = [
                    [11, 12], [11, 23], [12, 24], [23, 24],
                    [11, 13], [13, 15], [12, 14], [14, 16],
                    [23, 25], [25, 27], [24, 26], [26, 28]
                ];

                const depth = this.poseDetector.currentState.squatDepth;
                let color = 'rgba(204, 0, 0, 0.8)';
                if (depth >= 0.7) {
                    color = 'rgba(45, 74, 28, 0.8)';
                } else if (depth >= 0.4) {
                    color = 'rgba(255, 165, 0, 0.8)';
                }

                ctx.strokeStyle = color;
                ctx.lineWidth = 3;

                connections.forEach(([start, end]) => {
                    const startPoint = landmarks[start];
                    const endPoint = landmarks[end];

                    if (startPoint && endPoint) {
                        ctx.beginPath();
                        ctx.moveTo(startPoint.x * width, startPoint.y * height);
                        ctx.lineTo(endPoint.x * width, endPoint.y * height);
                        ctx.stroke();
                    }
                });

                const keyPoints = [11, 12, 23, 24, 25, 26, 27, 28];
                ctx.fillStyle = '#d4af37';

                keyPoints.forEach(index => {
                    const point = landmarks[index];
                    if (point) {
                        ctx.beginPath();
                        ctx.arc(point.x * width, point.y * height, 4, 0, 2 * Math.PI);
                        ctx.fill();
                    }
                });
            }

            requestAnimationFrame(drawPreview);
        };

        drawPreview();
    }

    /**
     * プレビューキャンバスに顔マスクを描画
     */
    drawFaceMaskOnPreview(landmarks, ctx, width, height) {
        const nose = landmarks[0];
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        
        if (!nose || !leftShoulder || !rightShoulder) return;
        
        const centerX = nose.x * width;
        const centerY = nose.y * height;
        
        const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x) * width;
        const faceWidth = shoulderWidth * 0.5;
        const faceHeight = faceWidth * 1.3;
        
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, faceWidth / 2, faceHeight / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();
        
        ctx.font = `${faceWidth * 0.6}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👹', centerX, centerY);
        ctx.restore();
    }

    /**
     * トレーニングキャンバスの設定
     */
    setupTrainingCanvas() {
        const canvas = this.elements.trainingCanvas;
        const ctx = canvas.getContext('2d');
        this.isExtraTraining = false;
        
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        
        resize();
        
        const draw = () => {
            if (this.currentScreen !== 'training') return;
            
            const width = canvas.width;
            const height = canvas.height;
            
            // 背景
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            
            if (this.isExtraTraining) {
                // 追加訓練時は赤みがかった背景
                gradient.addColorStop(0, '#2a1515');
                gradient.addColorStop(0.5, '#3d1a1a');
                gradient.addColorStop(1, '#2a1515');
            } else {
                // 通常の背景
                gradient.addColorStop(0, '#1a1a1a');
                gradient.addColorStop(0.5, '#2d2d2d');
                gradient.addColorStop(1, '#1a1a1a');
            }
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
            
            // スキャンライン効果
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            for (let y = 0; y < height; y += 4) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
            
            // 追加訓練時のビネット効果
            if (this.isExtraTraining) {
                const vignette = ctx.createRadialGradient(
                    width / 2, height / 2, 0,
                    width / 2, height / 2, Math.max(width, height) * 0.7
                );
                vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
                vignette.addColorStop(1, 'rgba(100, 0, 0, 0.5)');
                ctx.fillStyle = vignette;
                ctx.fillRect(0, 0, width, height);
            }
            
            requestAnimationFrame(draw);
        };
        
        draw();
    }

    /**
     * 結果画面を表示
     */
    showResult(count, message) {
        const depthCounts = this.poseDetector.getDepthCounts();
        
        this.ui.resultMessage.textContent = message;
        this.ui.finalCount.textContent = count;
        this.ui.resultDeep.textContent = depthCounts.deep;
        this.ui.resultMedium.textContent = depthCounts.medium;
        this.ui.resultShallow.textContent = depthCounts.shallow;

        this.showScreen('result');
    }

    /**
     * リスタート
     */
    restart() {
        if (this.sergeant) {
            this.sergeant.stop();
        }
        this.poseDetector.resetCalibration();
        
        // UIリセット
        this.ui.calibrationProgress.style.width = '0%';
        this.ui.progressText.textContent = '0%';
        this.ui.calibrationTimer.textContent = '';
        this.ui.fullbodyOverlay.classList.remove('hidden');
        this.ui.extraTrainingOverlay.classList.remove('active');
        this.isExtraTraining = false;
        
        // テンポ表示リセット
        this.ui.tempoBeatNumber.textContent = '1';
        const dots = document.querySelectorAll('.beat-dot');
        dots.forEach(dot => dot.classList.remove('active', 'current'));
        
        this.showScreen('calibration');
    }

    /**
     * リサイズ処理
     */
    handleResize() {
        if (this.elements.trainingCanvas) {
            this.elements.trainingCanvas.width = window.innerWidth;
            this.elements.trainingCanvas.height = window.innerHeight;
        }
    }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
    window.drillApp = new DrillApp();
});

