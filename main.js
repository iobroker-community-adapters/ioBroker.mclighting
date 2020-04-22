'use strict';
const utils = require('@iobroker/adapter-core');
const WebSocket = require('ws');

let adapter, pingTimer, timeoutTimer, rgbw, isAlive = false, flag = false, list_modes = null, mclighting, state_current = {}, timeOutRGB, timeOutSend, timeOutReconnect;

function startAdapter(options){
    return adapter = utils.adapter(Object.assign({}, options, {
        systemConfig: true,
        name:         'mclighting',
        ready:        main,
        unload:       (callback) => {
            try {
                adapter.log.debug('cleaned everything up...');
                mclighting && mclighting.close();
                pingTimer && clearInterval(pingTimer);
                timeoutTimer && clearInterval(timeoutTimer);
                timeOutRGB && clearTimeout(timeOutRGB);
                timeOutSend && clearTimeout(timeOutSend);
                timeOutReconnect && clearTimeout(timeOutReconnect);
                callback();
            } catch (e) {
                callback();
            }
        },
        stateChange:  (id, state) => {
            if (id && state && !state.ack){
                adapter.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                let sendChar = '*';
                if (state_current.ws2812fx_mode !== 0){
                    sendChar = '#';
                }
                let ids = id.split(".");
                let name = ids[ids.length - 2].toString();
                let command = ids[ids.length - 1].toString();
                let val = state.val;
                if (command === 'power'){
                    if (val){
                        send('%' + 255);
                    } else {
                        send('%' + 0);
                    }
                }
                if (command === 'mode'){
                    send('=' + val);
                }
                if (command === 'fx_mode'){
                    send('/' + val);
                }
                if (command === 'color'){
                    let c = val.split(",");
                    if (c.length >= 3){
                        let r = c[0] || 0;
                        let g = c[1] || 0;
                        let b = c[2] || 0;
                        if (c.length >= 4 && rgbw){
                            let w = c[3] || 0;
                            send(sendChar + rgbwToHex(parseInt(r), parseInt(g), parseInt(b), parseInt(w)));
                        } else {
                            send(sendChar + rgbwToHex(parseInt(r), parseInt(g), parseInt(b)));
                        }
                    }
                }
                if (command === 'color_R' || command === 'color_G' || command === 'color_B' || command === 'color_W'){
                    if (!flag){
                        flag = true;
                        timeOutRGB = setTimeout( ()=> {
                            let r, g, b, w;
                            timeOutRGB = null;
                            adapter.getState('color_R',  (err, state_r)=>{
                                if (!err){
                                    r = state_r !== null ? state_r.val :0;
                                    adapter.getState('color_G',  (err, state_g)=>{
                                        if (!err){
                                            g = state_g !== null ? state_g.val :0;
                                            adapter.getState('color_B',  (err, state_b)=>{
                                                if (!err){
                                                    b = state_b !== null ? state_b.val :0;
                                                    if (rgbw){
                                                        adapter.getState('color_W',  (err, state_w)=>{
                                                            if (!err){
                                                                w = state_w !== null ? state_w.val :0;
                                                                send(sendChar + rgbwToHex(r, g, b, w));
                                                                send('$');
                                                            }
                                                        });
                                                    } else {
                                                        send(sendChar + rgbwToHex(r, g, b));
                                                        send('$');
                                                    }
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                            flag = false;
                        }, 1000);
                    }
                }
                if (command === (rgbw ? 'color_RGBW' :'color_RGB')){
                    val = val.replace('#', '');
                    if (rgbw){
                        val = val.slice(6, 8) + val.slice(0, 6);
                    }
                    send(sendChar + val);
                }
                if (command === (rgbw ? 'set_all_RGBW' :'set_all_RGB')){
                    val = val.replace('#', '');
                    if (rgbw){
                        val = val.slice(6, 8) + val.slice(0, 6);
                    }
                    send('*' + val);
                }
                if (command === (rgbw ? 'single_RGBW' :'single_RGB')){
                    val = val.replace('#', '');
                    if (rgbw){
                        val = val.slice(0, 2) + val.slice(8, 10) + val.slice(2, 8);
                    }
                    send('!' + val);
                }
                if (command === (rgbw ? 'array_RGBW' :'array_RGB')){
                    if (~val.indexOf('+')){
                        if (val[0] !== '+'){
                            val = '+' + val;
                        }
                    } else {
                        val = '+' + val.replace(/\s/g, '').replace(',', '+').replace('[', '').replace(']', '');
                        adapter.log.debug('Send ' + command + ': ' + val);
                    }
                    if (rgbw){
                        for (let i = 0; i < val.length; i = i + 11) {
                            const part = val.slice(i, i + 3) + val.slice(i + 9, i + 11) + val.slice(i + 3, i + 9);
                            val = val.slice(0, i) + part + val.slice(i + 11, val.length)
                        }
                    }
                    send(val);
                }
                if (command === (rgbw ? 'range_RGBW' :'range_RGB')){
                    if (~val.indexOf('R')){
                        if (val[0] !== 'R'){
                            val = 'R' + val;
                        }
                    } else {
                        val = 'R' + val.replace(/\s/g, '').replace(',', 'R').replace('[', '').replace(']', '');
                        adapter.log.debug('Send ' + command + ': ' + val);
                    }
                    if (rgbw){
                        for (let i = 0; i < val.length; i = i + 13) {
                            const part = val.slice(i, i + 5) + val.slice(i + 11, i + 13) + val.slice(i + 5, i + 11);
                            val = val.slice(0, i) + part + val.slice(i + 13, val.length)
                        }
                    }
                    send(val);
                }
                if (command === 'speed'){
                    if (val > 255) val = 255;
                    if (val < 0) val = 0;
                    send('?' + val);
                }
                if (command === 'brightness'){
                    if (val > 255) val = 255;
                    if (val < 0) val = 0;
                    send('%' + val);
                }
                if (!flag){
                    send('$');
                }
            }
        }
    }));
}

let connect = ()=>{
    mclighting && mclighting.close();
    let host = adapter.config.host ? adapter.config.host :'127.0.0.1';
    let port = adapter.config.port ? adapter.config.port :81;
    adapter.log.info('McLighting connect to: ' + host + ':' + port + ' ' + (rgbw ? ' with RGBW' :''));

    mclighting = new WebSocket('ws://' + host + ':' + port, {
        perMessageDeflate: false
    });

    mclighting.on('open', () => {
        adapter.log.info(mclighting.url + ' McLighting connected');
        send('$');
        timeOutSend = setTimeout(() => {
            timeOutSend = null;
            send('~');
        }, 5000);
        pingTimer = setInterval( ()=>{
            mclighting.ping('ping'); // Работает только на "ws": "^5.1.0", на последних версиях возращает ошибку.
        }, 10000);
        timeoutTimer = setInterval(() => {
            if (!isAlive){
                mclighting && mclighting.close();
            } else {
                isAlive = false;
            }
        }, 60000);
    });
    mclighting.on('pong', (msg) => {
        isAlive = true;
        adapter.log.debug(mclighting.url + ' receive a pong : ' + msg);
    });

    mclighting.on('message', (msg) => {
        adapter.log.debug('Response message - ' + msg);
        isAlive = true;
        if (msg === 'Connected'){
            adapter.setState('info.connection', true, true);
        }
        if (msg !== "OK" && msg !== 'Connected'){
            parse(msg);
        }
    });

    mclighting.on('error', (e) => {
        adapter.log.debug('Error WS - ' + e);
    });
    mclighting.on('close', (e) => {
        pingTimer && clearInterval(pingTimer);
        timeoutTimer && clearInterval(timeoutTimer);
        adapter.log.debug('ERROR! WS CLOSE, CODE - ' + e);
        adapter.log.debug('McLighting reconnect after 10 seconds');
        adapter.setState('info.connection', false, true);
        timeOutReconnect = setTimeout(() => {
            timeOutReconnect = null; 
            connect();
        }, 10000);
    });
};


function send(data){
    if (mclighting){
        mclighting.send(data, (e)=>{
            if (e){
                adapter.log.error('Send command: {' + data + '}, ERROR - ' + e);
                if (~e.toString().indexOf('CLOSED')){
                    adapter.setState('info.connection', false, true);
                    connect();
                }
            } else {
                adapter.log.debug('Send command:{' + data + '}');
            }
        });
    }
}

function parse(data){
    let obj;
    try {
        obj = JSON.parse(data);
        if (obj.mode && obj.brightness){
            state_current = obj;
            for (let key in obj) {
                if (obj.hasOwnProperty(key)){
                    if (key === 'color'){
                        const length = obj[key].length;

                        if (length >= 3){
                            setStates('color_R', obj[key][(rgbw ? 1 :0)]);
                            setStates('color_G', obj[key][1 + (rgbw ? 1 :0)]);
                            setStates('color_B', obj[key][2 + (rgbw ? 1 :0)]);
                            if (length >= 4 && rgbw){
                                setStates('color_W', obj[key][0]);
                                const hex = rgbwToHex(obj[key][2], obj[key][3], obj[key][0], obj[key][1]);
                                setStates('color_RGBW', hex);
                                setStates('color', obj[key][1] + ',' + obj[key][2] + ',' + obj[key][3] + ',' + obj[key][0]);
                            } else {
                                setStates('color_RGB', rgbwToHex(obj[key][0], obj[key][1], obj[key][2]));
                                setStates('color', obj[key][0] + ',' + obj[key][1] + ',' + obj[key][2]);
                            }
                        }
                    } else {
                        setStates(key, obj[key]);
                    }
                }
                if (key === 'ws2812fx_mode'){
                    setStates('fx_mode', obj['ws2812fx_mode']);
                }
                if (key === 'ws2812fx_mode_name'){
                    setStates('fx_mode_name', obj['ws2812fx_mode_name']);
                }

            }
        }
        if (typeof obj[0] === 'object'){
            setStates('list_modes', JSON.stringify(obj));
            list_modes = obj;
        }
    } catch (err) {
        adapter.log.debug('Error parse - ' + err);
    }
}

function setStates(name, val){
    adapter.log.debug("set state name: " + name + " val: " + val);
    adapter.getState(name,  (err, state)=>{
        if (err){
            adapter.log.warn('Send this data to developers ' + name);
        } else {
            adapter.setState(name, {
                val: val,
                ack: true
            });
        }
    });
}

function rgbwToHex(r, g, b, w){
    return componentToHex(w) + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function componentToHex(c){
    if (c !== null && c !== undefined){
        let hex = c.toString(16);
        return hex.length === 1 ? "0" + hex :hex;
    } else {
        return '';
    }
}

function createStates(){
    rgbw = adapter.config.rgbw;
    adapter.setObjectNotExists(rgbw ? "color_RGBW" :"color_RGB", {
        type:   "state",
        common: {
            role:  "state",
            name:  "Set default color of the lamp",
            type:  "string",
            read:  true,
            write: true,
            def:   false
        }
    });
    adapter.setObjectNotExists(rgbw ? "set_all_RGBW" :"set_all_RGB", {
        type:   "state",
        common: {
            role:  "state",
            name:  "Set default color of the lamp and light all LEDs in that color",
            type:  "string",
            read:  true,
            write: true,
            def:   false
        }
    });
    adapter.setObjectNotExists(rgbw ? "single_RGBW" :"single_RGB", {
        type:   "state",
        common: {
            role:  "state",
            name:  "Light single LEDs in the given color",
            type:  "string",
            read:  true,
            write: true,
            def:   false
        }
    });
    adapter.setObjectNotExists(rgbw ? "array_RGBW" :"array_RGB", {
        type:   "state",
        common: {
            role:  "state",
            name:  "Light multiple LEDs in the given colors",
            type:  "string",
            read:  true,
            write: true,
            def:   false
        }
    });
    adapter.setObjectNotExists(rgbw ? "range_RGBW" :"range_RGB", {
        type:   "state",
        common: {
            role:  "state",
            name:  "Light multiple LED ranges in the given colors",
            type:  "string",
            read:  true,
            write: true,
            def:   false
        }
    });
    if (rgbw){
        adapter.setObjectNotExists("color_W", {
            type:   "state",
            common: {
                role:  "state",
                name:  "Set default White of the lamp",
                type:  "number",
                min:   0,
                max:   255,
                read:  true,
                write: true,
                def:   false
            }
        });
    }
}

function main(){
    createStates();
    adapter.subscribeStates('*');
    connect();
}

if (module.parent){
    module.exports = startAdapter;
} else {
    startAdapter();
}
