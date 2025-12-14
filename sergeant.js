/**
 * 鬼教官モジュール
 * セリフ管理とテンポ制御
 */

class DrillSergeant {
    constructor() {
        // テンポ設定（9拍子で1スクワット：5秒下げ + 4秒上げ）
        this.tempo = {
            bpm: 60,              // 1分間に60拍 = 1秒に1拍
            beatInterval: 1000,   // ミリ秒
            beatsPerSquat: 9,     // 9拍で1スクワット（5秒下げ + 4秒上げ）
            beatsDown: 5,         // 下げるのに5拍
            beatsUp: 4,           // 上げるのに4拍
            currentBeat: 0,
            lastBeatTime: 0,
            isRunning: false,
            expectedSquatBeat: 9, // 次にスクワット完了すべき拍
        };
        
        // 目標設定
        this.goal = 20;
        this.extraReps = 0;
        this.actualGoal = 0;
        
        // 状態
        this.currentCount = 0;
        this.lastSquatBeat = 0;
        this.missedBeats = 0;
        this.isFinished = false;
        this.isExtraTraining = false;
        this.lastSlowWarningBeat = 0; // 遅れ警告を出した最後の拍
        
        // オーディオ
        this.audioContext = null;
        this.speechSynth = window.speechSynthesis;
        this.isSpeaking = false;
        this.speechQueue = [];
        this.initAudio();
        
        // セリフ集
        this.messages = {
            shallow: [
                "浅い！もっと腰を落とせ！",
                "何だその中途半端なスクワットは！",
                "腰が高い！やり直しだ！",
                "そんなんじゃ効かんぞ！",
                "もっと深く！膝を曲げろ！",
                "手抜きは許さん！",
                "本気を出せ！",
                "ふざけるな！もっと沈め！",
            ],
            
            deep: [
                "{count}",
                "{count}！",
                "{count}！いいぞ",
            ],
            
            medium: [
                "{count}",
                "{count}！",
                "よし、{count}",
            ],
            
            slow: [
                "遅い！",
                "もっと早く！",
                "テンポについてこい！",
                "置いていくぞ！",
                "根性見せろ！",
            ],
            
            afterGoal: [
                "まだまだ！終わりは俺が決める！",
                "誰が終われと言った！続けろ！",
                "目標？そんなの通過点だ！",
                "甘えるな！まだ動ける！",
                "終わりじゃない！追い込め！",
            ],
            
            finish: [
                "まあ、合格だ。また鍛えてやる",
                "ごぼうの足がにんじんくらいにはなったか",
                "悪くない。次はもっといける",
                "その根性、嫌いじゃない。また来い",
                "少しはマシになったな",
                "思ったより持ったな。認めてやる",
                "今日はここまでだ。明日も来い",
            ],
            
            start: [
                "訓練開始だ！気合を入れろ！",
                "覚悟はいいな！始めるぞ！",
                "泣き言は聞かん！やるぞ！",
            ],
            
            countdown: ["5", "4", "3", "2", "1", "始め！"],
        };
        
        // コールバック
        this.onMessage = null;
        this.onBeat = null;
        this.onFinish = null;
        this.onExtraTraining = null;
        
        this.lastMessageIndex = {};
    }
    
    /**
     * オーディオ初期化
     */
    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }
    
    /**
     * 音声合成で読み上げ（鬼教官ボイス）
     */
    speak(text, priority = false) {
        if (!this.speechSynth) return;
        
        // 優先度が高い場合はキューをクリア
        if (priority) {
            this.speechSynth.cancel();
            this.speechQueue = [];
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ja-JP';
        utterance.rate = 1.1;   // 少しゆっくり、威圧感
        utterance.pitch = 0.5;  // かなり低い声
        utterance.volume = 1.0;
        
        // 日本語の男性っぽい声を探す
        const voices = this.speechSynth.getVoices();
        
        // 優先順位: Otoya(Mac) > Hattori(Mac) > Google日本語 > その他日本語
        const preferredVoices = [
            'Otoya',           // macOS 日本語男性
            'Hattori',         // macOS 日本語男性
            'Google 日本語',   // Chrome
            'Microsoft Ichiro', // Windows 日本語男性
            'ja-JP',           // 汎用
        ];
        
        let selectedVoice = null;
        for (const preferred of preferredVoices) {
            selectedVoice = voices.find(v => 
                v.name.includes(preferred) || v.lang.includes(preferred)
            );
            if (selectedVoice) break;
        }
        
        // 見つからなければ日本語の声を使う
        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.lang.includes('ja'));
        }
        
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        
        utterance.onend = () => {
            this.isSpeaking = false;
            this.processNextSpeech();
        };
        
        utterance.onerror = () => {
            this.isSpeaking = false;
            this.processNextSpeech();
        };
        
        if (this.isSpeaking && !priority) {
            this.speechQueue.push(utterance);
        } else {
            this.isSpeaking = true;
            this.speechSynth.speak(utterance);
        }
    }
    
    /**
     * 怒りモードで読み上げ（より低く、ゆっくり、威圧的）
     */
    speakAngry(text) {
        if (!this.speechSynth) return;
        
        this.speechSynth.cancel();
        this.speechQueue = [];
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ja-JP';
        utterance.rate = 0.9;   // ゆっくり、威圧感たっぷり
        utterance.pitch = 0.3;  // 超低音
        utterance.volume = 1.0;
        
        // 日本語の男性っぽい声を探す
        const voices = this.speechSynth.getVoices();
        const preferredVoices = ['Otoya', 'Hattori', 'Google 日本語', 'Microsoft Ichiro', 'ja-JP'];
        
        let selectedVoice = null;
        for (const preferred of preferredVoices) {
            selectedVoice = voices.find(v => 
                v.name.includes(preferred) || v.lang.includes(preferred)
            );
            if (selectedVoice) break;
        }
        
        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.lang.includes('ja'));
        }
        
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        
        utterance.onend = () => {
            this.isSpeaking = false;
            this.processNextSpeech();
        };
        
        utterance.onerror = () => {
            this.isSpeaking = false;
            this.processNextSpeech();
        };
        
        this.isSpeaking = true;
        this.speechSynth.speak(utterance);
    }
    
    /**
     * 利用可能な音声を取得（デバッグ用）
     */
    getAvailableVoices() {
        if (!this.speechSynth) return [];
        return this.speechSynth.getVoices().filter(v => v.lang.includes('ja'));
    }
    
    /**
     * 次の音声を処理
     */
    processNextSpeech() {
        if (this.speechQueue.length > 0) {
            const next = this.speechQueue.shift();
            this.isSpeaking = true;
            this.speechSynth.speak(next);
        }
    }
    
    /**
     * メトロノーム音を再生
     */
    playMetronomeClick(isStrong = false) {
        if (!this.audioContext) return;
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // 強拍は高い音、弱拍は低い音
        oscillator.frequency.setValueAtTime(isStrong ? 1200 : 900, this.audioContext.currentTime);
        oscillator.type = 'sine';
        
        const volume = isStrong ? 0.4 : 0.25;
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.08);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.08);
    }
    
    /**
     * 目標を設定
     */
    setGoal(goal) {
        this.goal = goal;
        this.extraReps = Math.floor(Math.random() * 16) + 5;
        this.actualGoal = this.goal + this.extraReps;
    }
    
    /**
     * ランダムにメッセージを選択
     */
    getRandomMessage(category, replacements = {}) {
        const messages = this.messages[category];
        if (!messages || messages.length === 0) return '';
        
        let index;
        if (messages.length === 1) {
            index = 0;
        } else {
            do {
                index = Math.floor(Math.random() * messages.length);
            } while (index === this.lastMessageIndex[category] && messages.length > 1);
        }
        
        this.lastMessageIndex[category] = index;
        
        let message = messages[index];
        
        for (const [key, value] of Object.entries(replacements)) {
            message = message.replace(`{${key}}`, value);
        }
        
        return message;
    }
    
    /**
     * トレーニング開始
     */
    start() {
        this.currentCount = 0;
        this.lastSquatBeat = 0;
        this.missedBeats = 0;
        this.isFinished = false;
        this.isExtraTraining = false;
        this.lastSlowWarningBeat = 0;
        this.tempo.currentBeat = 0;
        this.tempo.expectedSquatBeat = this.tempo.beatsPerSquat;
        this.tempo.lastBeatTime = Date.now();
        this.tempo.isRunning = true;
        
        // 音声キューをクリア
        if (this.speechSynth) {
            this.speechSynth.cancel();
        }
        this.speechQueue = [];
        this.isSpeaking = false;
        
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        // 開始メッセージ
        const startMsg = this.getRandomMessage('start');
        this.showMessage(startMsg);
        this.speak(startMsg, true);
        
        this.beatLoop();
    }
    
    /**
     * テンポループ
     */
    beatLoop() {
        if (!this.tempo.isRunning || this.isFinished) return;
        
        const now = Date.now();
        const elapsed = now - this.tempo.lastBeatTime;
        
        if (elapsed >= this.tempo.beatInterval) {
            this.tempo.lastBeatTime = now;
            this.tempo.currentBeat++;
            
            // メトロノーム音（9拍の1拍目が強拍、6拍目も上げ開始で強拍）
            const beatInBar = ((this.tempo.currentBeat - 1) % 9) + 1;
            const isStrong = beatInBar === 1 || beatInBar === 6;
            this.playMetronomeClick(isStrong);
            
            if (this.onBeat) {
                this.onBeat(this.tempo.currentBeat, isStrong);
            }
            
            // テンポ遅れチェック（4拍ごとにスクワット1回が期待される）
            // 期待されるタイミングから4拍（1サイクル）以上遅れたら警告
            if (this.currentCount > 0) {
                const expectedCount = Math.floor(this.tempo.currentBeat / this.tempo.beatsPerSquat);
                const behindBy = expectedCount - this.currentCount;
                
                // 1サイクル以上遅れていて、まだ警告していなければ
                if (behindBy >= 1 && 
                    this.tempo.currentBeat - this.lastSlowWarningBeat >= this.tempo.beatsPerSquat) {
                    const slowMsg = this.getRandomMessage('slow');
                    this.showMessage(slowMsg);
                    this.speakAngry(slowMsg); // 怒りモードで叱責
                    this.lastSlowWarningBeat = this.tempo.currentBeat;
                    this.missedBeats++;
                }
            }
        }
        
        requestAnimationFrame(() => this.beatLoop());
    }
    
    /**
     * スクワット完了時の処理
     */
    handleSquatComplete(count, depthCategory, depth) {
        // 終了後は無視
        if (this.isFinished) return;
        
        this.currentCount = count;
        this.lastSquatBeat = this.tempo.currentBeat;
        
        // 目標達成時
        if (count === this.goal) {
            this.isExtraTraining = true;
            const msg = this.getRandomMessage('afterGoal');
            this.showMessage(msg);
            this.speak(msg, true);
            
            if (this.onExtraTraining) {
                this.onExtraTraining(this.extraReps);
            }
            return;
        }
        
        // 終了チェック
        if (count >= this.actualGoal) {
            this.finish();
            return;
        }
        
        // 深さに応じたメッセージと音声
        let message;
        if (depthCategory === 'shallow') {
            message = this.getRandomMessage('shallow');
            this.showMessage(message);
            this.speakAngry(message); // 浅いは怒りモードで
        } else if (depthCategory === 'deep') {
            message = this.getRandomMessage('deep', { count: count });
            this.showMessage(message);
            // 深い時は回数だけ読み上げ
            this.speak(String(count));
        } else {
            message = this.getRandomMessage('medium', { count: count });
            this.showMessage(message);
            // 普通の時も回数だけ読み上げ
            this.speak(String(count));
        }
    }
    
    /**
     * 追加訓練中かどうか
     */
    isInExtraTraining() {
        return this.isExtraTraining;
    }
    
    /**
     * 追加訓練の残り回数
     */
    getExtraRemaining() {
        if (!this.isExtraTraining) return 0;
        return Math.max(0, this.actualGoal - this.currentCount);
    }
    
    /**
     * メッセージを表示
     */
    showMessage(message) {
        if (this.onMessage) {
            this.onMessage(message);
        }
    }
    
    /**
     * 訓練終了
     */
    finish() {
        this.isFinished = true;
        this.tempo.isRunning = false;
        
        const finishMessage = this.getRandomMessage('finish');
        
        // 終了メッセージを音声で
        setTimeout(() => {
            this.speak(finishMessage, true);
        }, 500);
        
        if (this.onFinish) {
            this.onFinish(this.currentCount, finishMessage);
        }
    }
    
    /**
     * 停止
     */
    stop() {
        this.tempo.isRunning = false;
        this.isFinished = true;
        if (this.speechSynth) {
            this.speechSynth.cancel();
        }
    }
    
    /**
     * カウントダウン音声
     */
    speakCountdown(text) {
        this.speak(text, true);
    }
}

window.DrillSergeant = DrillSergeant;
