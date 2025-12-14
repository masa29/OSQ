/**
 * ポーズ検出モジュール（鬼教官スクワット用）
 * MediaPipe Poseを使用してスクワット検出と深さ判定を行う
 */

class PoseDetector {
    constructor() {
        this.pose = null;
        this.camera = null;
        this.isInitialized = false;
        this.isCalibrated = false;
        
        // キャリブレーションデータ
        this.calibration = {
            standingHipY: 0,
            standingKneeY: 0,
            squatThreshold: 0.1,
            deepSquatThreshold: 0.2,
        };
        
        // 現在の状態
        this.currentState = {
            isSquatting: false,
            squatDepth: 0,
            squatCount: 0,
            lastSquatTime: 0,
            lastSquatDepth: 0,
            depthCategory: 'none',
        };
        
        // スクワット深さカウント
        this.depthCounts = {
            shallow: 0,
            medium: 0,
            deep: 0
        };
        
        // スクワット検出用内部状態
        this.state = 'standing';
        this.maxDepthThisSquat = 0;
        
        // キャリブレーション進捗
        this.calibrationSamples = [];
        this.calibrationProgress = 0;
        this.requiredSamples = 30;
        
        // 全身検出状態
        this.isFullBodyVisible = false;
        this.fullBodyDetectedTime = 0;
        this.calibrationStarted = false;
        
        // コールバック
        this.onPoseDetected = null;
        this.onCalibrationProgress = null;
        this.onCalibrationComplete = null;
        this.onFullBodyStatus = null;
        this.onSquatComplete = null;
        
        // 最新のランドマーク
        this.latestLandmarks = null;
    }
    
    /**
     * MediaPipe Poseを初期化
     */
    async initialize(videoElement, canvasElement) {
        this.videoElement = videoElement;
        this.canvasElement = canvasElement;
        this.canvasCtx = canvasElement.getContext('2d');
        
        this.pose = new Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
        });
        
        this.pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        this.pose.onResults((results) => this.onResults(results));
        
        this.camera = new Camera(videoElement, {
            onFrame: async () => {
                await this.pose.send({ image: videoElement });
            },
            width: 640,
            height: 480
        });
        
        await this.camera.start();
        this.isInitialized = true;
        
        return true;
    }
    
    /**
     * ポーズ検出結果の処理
     */
    onResults(results) {
        this.canvasElement.width = this.videoElement.videoWidth;
        this.canvasElement.height = this.videoElement.videoHeight;
        
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        if (results.poseLandmarks) {
            this.latestLandmarks = results.poseLandmarks;
            
            this.drawPose(results.poseLandmarks);
            
            if (!this.isCalibrated) {
                this.processCalibration(results.poseLandmarks);
            } else {
                this.updateGameState(results.poseLandmarks);
            }
            
            if (this.onPoseDetected) {
                this.onPoseDetected(this.currentState);
            }
        }
    }
    
    /**
     * ポーズを描画
     */
    drawPose(landmarks) {
        const ctx = this.canvasCtx;
        const width = this.canvasElement.width;
        const height = this.canvasElement.height;
        
        // 顔をマスク
        this.drawFaceMask(landmarks, ctx, width, height);
        
        const connections = [
            [11, 12], [11, 23], [12, 24], [23, 24],
            [11, 13], [13, 15],
            [12, 14], [14, 16],
            [23, 25], [25, 27],
            [24, 26], [26, 28]
        ];
        
        const depthColor = this.getDepthColor(this.currentState.squatDepth);
        
        ctx.strokeStyle = depthColor;
        ctx.lineWidth = 4;
        
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
        
        keyPoints.forEach(index => {
            const point = landmarks[index];
            if (point) {
                ctx.beginPath();
                ctx.arc(point.x * width, point.y * height, 8, 0, 2 * Math.PI);
                ctx.fillStyle = '#d4af37';
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });
    }
    
    /**
     * 顔をマスクする
     */
    drawFaceMask(landmarks, ctx, width, height) {
        // 顔の中心（鼻）
        const nose = landmarks[0];
        // 左耳、右耳で顔の幅を推定
        const leftEar = landmarks[7];
        const rightEar = landmarks[8];
        // 肩で体の幅を参考に
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        
        if (!nose || !leftShoulder || !rightShoulder) return;
        
        // 顔の中心座標
        const centerX = nose.x * width;
        const centerY = nose.y * height;
        
        // 肩幅から顔のサイズを推定（肩幅の約40%）
        const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x) * width;
        const faceWidth = shoulderWidth * 0.5;
        const faceHeight = faceWidth * 1.3;
        
        // 楕円形のマスクを描画
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, faceWidth / 2, faceHeight / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();
        
        // 鬼教官の絵文字を顔の代わりに表示
        ctx.font = `${faceWidth * 0.6}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👹', centerX, centerY);
        ctx.restore();
    }
    
    /**
     * 深さに応じた色を取得
     */
    getDepthColor(depth) {
        if (depth < 0.4) {
            return 'rgba(204, 0, 0, 0.9)'; // 赤（浅い）
        } else if (depth < 0.7) {
            return 'rgba(255, 165, 0, 0.9)'; // オレンジ（普通）
        } else {
            return 'rgba(45, 74, 28, 0.9)'; // 緑（深い）
        }
    }
    
    /**
     * 全身が検出されているかチェック
     */
    checkFullBodyVisibility(landmarks) {
        const requiredPoints = {
            11: '左肩', 12: '右肩',
            23: '左股関節', 24: '右股関節',
            25: '左膝', 26: '右膝',
            27: '左足首', 28: '右足首'
        };
        
        const missingParts = [];
        const minVisibility = 0.5;
        
        for (const [index, name] of Object.entries(requiredPoints)) {
            const point = landmarks[parseInt(index)];
            if (!point || point.visibility < minVisibility) {
                missingParts.push(name);
            }
        }
        
        return {
            isFullBody: missingParts.length === 0,
            missingParts: missingParts
        };
    }
    
    /**
     * キャリブレーション処理（全身検出後2秒待ってから開始）
     */
    processCalibration(landmarks) {
        const bodyCheck = this.checkFullBodyVisibility(landmarks);
        const wasFullBody = this.isFullBodyVisible;
        this.isFullBodyVisible = bodyCheck.isFullBody;
        
        // 全身検出状態をコールバック
        if (this.onFullBodyStatus) {
            this.onFullBodyStatus(bodyCheck.isFullBody, bodyCheck.missingParts);
        }
        
        // 全身が写っていない場合
        if (!bodyCheck.isFullBody) {
            this.fullBodyDetectedTime = 0;
            this.calibrationStarted = false;
            if (this.onCalibrationProgress) {
                this.onCalibrationProgress(this.calibrationProgress, false, 'not_full_body', 0);
            }
            return;
        }
        
        // 全身が写り始めた時刻を記録
        if (!wasFullBody && bodyCheck.isFullBody) {
            this.fullBodyDetectedTime = Date.now();
        }
        
        // 2秒待つ
        const waitTime = 2000;
        const elapsed = Date.now() - this.fullBodyDetectedTime;
        
        if (elapsed < waitTime) {
            const remainingSeconds = Math.ceil((waitTime - elapsed) / 1000);
            if (this.onCalibrationProgress) {
                this.onCalibrationProgress(0, false, 'waiting', remainingSeconds);
            }
            return;
        }
        
        this.calibrationStarted = true;
        
        // 立ち姿勢でキャリブレーション
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        const leftKnee = landmarks[25];
        const rightKnee = landmarks[26];
        
        const hipY = (leftHip.y + rightHip.y) / 2;
        const kneeY = (leftKnee.y + rightKnee.y) / 2;
        
        const isStanding = (kneeY - hipY) > 0.15;
        
        if (isStanding) {
            this.calibrationSamples.push({
                hipY: hipY,
                kneeY: kneeY
            });
            
            this.calibrationProgress = Math.min(100, (this.calibrationSamples.length / this.requiredSamples) * 100);
            
            if (this.onCalibrationProgress) {
                this.onCalibrationProgress(this.calibrationProgress, true, 'standing', 0);
            }
            
            if (this.calibrationSamples.length >= this.requiredSamples) {
                this.completeCalibration();
            }
        } else {
            if (this.onCalibrationProgress) {
                this.onCalibrationProgress(this.calibrationProgress, false, 'not_standing', 0);
            }
        }
    }
    
    /**
     * キャリブレーション完了
     */
    completeCalibration() {
        const sum = this.calibrationSamples.reduce((acc, sample) => ({
            hipY: acc.hipY + sample.hipY,
            kneeY: acc.kneeY + sample.kneeY
        }), { hipY: 0, kneeY: 0 });
        
        const count = this.calibrationSamples.length;
        this.calibration.standingHipY = sum.hipY / count;
        this.calibration.standingKneeY = sum.kneeY / count;
        
        const legLength = this.calibration.standingKneeY - this.calibration.standingHipY;
        this.calibration.squatThreshold = legLength * 0.15;
        this.calibration.deepSquatThreshold = legLength * 0.4;
        
        this.isCalibrated = true;
        
        if (this.onCalibrationComplete) {
            this.onCalibrationComplete(this.calibration);
        }
    }
    
    /**
     * ゲーム中の状態更新
     */
    updateGameState(landmarks) {
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        
        if (!leftHip || !rightHip) return;
        
        const currentHipY = (leftHip.y + rightHip.y) / 2;
        const displacement = currentHipY - this.calibration.standingHipY;
        
        const rawDepth = displacement / this.calibration.deepSquatThreshold;
        this.currentState.squatDepth = Math.max(0, Math.min(1, rawDepth));
        this.currentState.isSquatting = displacement > this.calibration.squatThreshold;
        
        switch (this.state) {
            case 'standing':
                if (displacement > this.calibration.squatThreshold) {
                    this.state = 'squatting';
                    this.maxDepthThisSquat = this.currentState.squatDepth;
                }
                break;
                
            case 'squatting':
                if (this.currentState.squatDepth > this.maxDepthThisSquat) {
                    this.maxDepthThisSquat = this.currentState.squatDepth;
                }
                
                if (displacement < this.calibration.squatThreshold * 0.5) {
                    this.state = 'standing';
                    this.currentState.squatCount++;
                    this.currentState.lastSquatTime = Date.now();
                    this.currentState.lastSquatDepth = this.maxDepthThisSquat;
                    
                    if (this.maxDepthThisSquat < 0.4) {
                        this.currentState.depthCategory = 'shallow';
                        this.depthCounts.shallow++;
                    } else if (this.maxDepthThisSquat < 0.7) {
                        this.currentState.depthCategory = 'medium';
                        this.depthCounts.medium++;
                    } else {
                        this.currentState.depthCategory = 'deep';
                        this.depthCounts.deep++;
                    }
                    
                    // スクワット完了コールバック
                    if (this.onSquatComplete) {
                        this.onSquatComplete(this.currentState.squatCount, this.currentState.depthCategory, this.maxDepthThisSquat);
                    }
                    
                    this.maxDepthThisSquat = 0;
                }
                break;
        }
    }
    
    /**
     * 深さカウントを取得
     */
    getDepthCounts() {
        return { ...this.depthCounts };
    }
    
    /**
     * キャリブレーションをリセット
     */
    resetCalibration() {
        this.isCalibrated = false;
        this.calibrationSamples = [];
        this.calibrationProgress = 0;
        this.state = 'standing';
        this.maxDepthThisSquat = 0;
        this.isFullBodyVisible = false;
        this.fullBodyDetectedTime = 0;
        this.calibrationStarted = false;
        this.currentState = {
            isSquatting: false,
            squatDepth: 0,
            squatCount: 0,
            lastSquatTime: 0,
            lastSquatDepth: 0,
            depthCategory: 'none',
        };
        this.depthCounts = {
            shallow: 0,
            medium: 0,
            deep: 0
        };
    }
    
    /**
     * カメラを停止
     */
    stop() {
        if (this.camera) {
            this.camera.stop();
        }
    }
}

window.PoseDetector = PoseDetector;


