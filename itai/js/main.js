var $notes = $('.notes'),//音符
    $bottomBarrier = $('.bottom-barrier');
navigator.getUserMedia = (navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia);
var exports = {
    init: function () {
        exports.bind();
        exports.initStat();
        exports.getSpeaker();
    },
    config: {
        barrierWidth: 80,//障碍物宽
        containerWidth: $('.container').width(),//大容器宽
        numberOfBarrier: 0,//容器障碍物数目
        rank: 2,//难度1,2,3
        timer: null,
        lockMove: false,//锁定移动
        lockLost: false,//坑来了，开始判断
        dangerArea: [null, null],//危险区域,碰撞区域
        $tmpBarrier: $(".barrier-low"),
        lockConsole: true,
        volSum: 0,//音量大小
        vol: 0,
        score: 0,
        gameEnd: false,
        walkValue: 1,//走的音量临界值
        jumpValue: ~~$('.threshold').val()//起跳的音量临界值
    },
    audioContext: new AudioContext(),
    audio: new Audio(),
    bind: function () {
        $(document).on('keydown', function (e) {//keyCode = 38 上，39 下
            // e.preventDefault();
            if (e.keyCode === 39) {
                exports.moveBarrier();
            }
            if (e.keyCode === 38) {
                exports.jumpNotes();
            }
            if (e.keyCode === 32) {
                exports.config.lockConsole = !exports.config.lockConsole;
            }
        }).on('keyup', function (e) {
            // e.preventDefault();
            if (e.keyCode === 39) {
                exports.stopBarrier();
            }
        }).on('change', '.threshold', function () {
            var val = ~~$(this).val()
            exports.config.jumpValue = val < 0 ? 1 : (val > 40 ? 40 : val);
        });
    },
    initStat: function () {//初始化障碍物宽高，初始化载体
        $('.barrier').width(exports.config.barrierWidth);
        exports.config.numberOfBarrier = Math.ceil(exports.config.containerWidth / exports.config.barrierWidth) + 2;
        $('.bottom-barrier').width(exports.config.numberOfBarrier * exports.config.barrierWidth);//障碍物容器宽
        exports.createBarrier(exports.config.numberOfBarrier);//创建并填充
    },
    getAudio: function () {//获取audio源
        var source = exports.audioContext.createMediaElementSource(exports.audio);
        source.connect(exports.audioContext.destination);
    },
    getSpeaker: function () {//链接麦克风 并获取音调数据

        if (!navigator.getUserMedia) {
            alert('不支持麦克风录音');
            return;
        }
        navigator.getUserMedia({audio: true}, function (stream) {
            console.log(stream);
            var source = exports.audioContext.createMediaStreamSource(stream);
            //用于录音的processor节点
            var recorder = exports.audioContext.createScriptProcessor(1024, 1, 1);
            source.connect(recorder);
            var analyser = exports.audioContext.createAnalyser();
            recorder.connect(analyser);
            // source.connect(analyser);
            // 让扬声器的音频通过分析器
            analyser.connect(exports.audioContext.destination);
            // 设置数据
            analyser.fftSize = 1024;//频道数量
            bufferLength = analyser.fftSize;
            dataArray = new Float32Array(bufferLength);//每个频道的频率
            // recorder.connect(exports.audioContext.destination)
            recorder.onaudioprocess = function (e) {
                var inputBuffer = e.inputBuffer;
                // console.log(inputBuffer)
                var ave = 0;
                var outputBuffer = e.outputBuffer;
                for (var channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
                    var inputData = inputBuffer.getChannelData(channel);
                    var outputData = outputBuffer.getChannelData(channel);
                    for (var sample = 0; sample < inputBuffer.length; sample++) {
                        outputData[sample] = inputData[sample];//返耳
                        ave += inputData[sample]
                    }
                    analyser.getFloatTimeDomainData(dataArray);//获取振幅信息
                    if (exports.config.lockConsole) {
                        var multi = exports.getAverage(dataArray) * 1000;
                        if (multi < 0) return;
                        exports.getVolume(multi);
                    }
                }
            };
        }, function (err) {
            console.log('err', err)
            alert('未获取到麦克风权限')
        });
    },
    getVolume: function (data) {//获取音频 振幅
        var total = 4;
        exports.config.volSum++;
        exports.config.vol += data;
        if (exports.config.volSum >= total) {
            exports.config.volSum = 0;
            exports.letsGo(exports.config.vol / total);
            exports.config.vol = 0;
        }
    },
    letsGo: function (vol) {//达到条件行走或者跳跃
        // console.log(vol)
        //$('.ttt').text(vol)
        if (vol > exports.config.walkValue) {//走
            exports.moveBarrier();
            if (vol > exports.config.jumpValue) {//跳
                console.log('jump')
                exports.jumpNotes();
            }
        } else {//停
            exports.stopBarrier();
        }
    },
    jumpNotes: function () {//音符跳动
        if (exports.config.gameEnd) return;
        var bottom = parseInt($notes.css("bottom")),
            height = 100;
        if (bottom >= 200 + height) return;
        $notes.stop(true).animate({bottom: bottom + height}, 500, "swing", function () {
            $notes.animate({bottom: 200}, 500, "linear", function () {
                exports.judgeLost();
            })
        })
    },
    judgeLost: function () {//是否失败
        var $barrier = $bottomBarrier.children().eq(2);
        var step = 4;
        if ($barrier.hasClass('barrier-high')) {
            exports.config.lockLost = false;
            exports.config.dangerArea = [null, null];
            return;
        }
        if (exports.config.$tmpBarrier.attr('data-id') !== $barrier.attr("data-id")) {
            exports.config.score += 5;
            $('.j_score').text(exports.config.score);
            exports.config.$tmpBarrier = $barrier;
            exports.config.lockLost = true;
            exports.config.dangerArea[0] = (exports.config.dangerArea[0] !== null ? exports.config.dangerArea[0] : $barrier.offset().left);
            exports.config.dangerArea[1] = (exports.config.dangerArea[1] !== null ? exports.config.dangerArea[1] + exports.config.barrierWidth : exports.config.dangerArea[0] + exports.config.barrierWidth);
        }
        exports.config.dangerArea[0] = exports.config.dangerArea[0] - step;
        exports.config.dangerArea[1] = exports.config.dangerArea[1] - step;
        if (parseInt($notes.css("bottom")) <= 200) {//判断是否在区间
            var left = exports.config.dangerArea[0],
                right = exports.config.dangerArea[1];
            // console.log(left,right)
            if (left <= 80 && right >= 160) {
                exports.lost();
            }
        }
    },
    lost: function () {//输了掉坑了
        console.log("lost!!!!!!!!")
        $('.title').text('啊！掉坑了！重新来一遍吧！')
        exports.stopBarrier();
        exports.config.gameEnd = true;
        $notes.stop(true).animate({bottom: 0}, 500)
        setTimeout(function () {
            exports.config.gameEnd = false;
            $('.bottom-barrier').html("");
            exports.initStat();
            $notes.css("bottom", 200)
            $('.title').text('大声点！不要停！八分音符酱')
            exports.config.score = 0;
            $('.j_score').text(exports.config.score);
        }, 3000)
    },
    moveBarrier: function () {//障碍物移动
        if (exports.config.gameEnd) return;
        var $b = $('.bottom-barrier'),
            step = 4;//移动速度s
        if (exports.config.lockMove) return;
        exports.config.lockMove = true;
        exports.config.timer = setInterval(function () {
            $b.css('left', parseInt($b.css("left")) - step);
            if (parseInt($b.css("left")) <= -exports.config.barrierWidth) {//删掉第一个元素然后随机填充最后一个。
                $b.children().eq(0).remove();
                $b.css("left", 0)
                $b.append(exports.createBarrier(1));
            }
            exports.judgeLost();
        }, 30);
    },
    stopBarrier: function () {//停止障碍物移动
        exports.config.lockMove = false;
        clearInterval(exports.config.timer);
    },
    createBarrier: function (num) {//创建障碍物，num个数
        var $bc = $('.bottom-barrier'),
            random = parseInt(Math.random() * 10),
            type = 1;
        if (num <= 1) {
            num = 1;//没有指定个数默认为1个
            switch (exports.config.rank) {
                case 1:
                    type = random >= 3 ? 1 : 2;
                    break;
                case 2:
                    type = random >= 4 ? 1 : 2;
                    break;
                case 3:
                    type = random >= 5 ? 1 : 2;
                    break;
            }
        }
        $bc.append(exports.getBarrier(num, type));
    },
    getBarrier: function (num, type) {//获取障碍物
        var html = "";
        for (var i = 0; i < num; i++) {
            html += '<div class="barrier ' + (type === 1 ? "barrier-high" : "barrier-low") + '" data-id="' + new Date().getTime() + '">》</div>'
        }
        return html;
    },
    getAverage: function (arr) {//音量均值
        var sum = 0;
        for (var i = 0, len = arr.length; i < len; i++) {
            sum += arr[i];
        }
        return sum / arr.length;
    }
}
exports.init();