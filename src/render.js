const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const https = require("https")

const region = "eu"

async function getLockfile(){
    const lockfilePath = path.join(process.env['LOCALAPPDATA'], 'Riot Games\\Riot Client\\Config\\lockfile');
    const contents = await fs.promises.readFile(lockfilePath, 'utf8');
    let d = {};
    [d.name, d.pid, d.port, d.password, d.protocol] = contents.split(':');
    return d;
}

async function getLocalHeaders(password){
    return {
        'Authorization': 'Basic ' + Buffer.from(`riot:${password}`).toString('base64')
    }
}

async function getVersion(){
    let res = await axios.get('https://valorant-api.com/v1/version')
    return res.data.data.riotClientVersion
}


async function getHeaders(localHeaders, port){
    const entitlements = await axios.get(`https://127.0.0.1:${port}/entitlements/v1/token`, {
        headers: localHeaders,
        httpsAgent: new https.Agent({
            rejectUnauthorized: false
        })
    })
    const version = await getVersion()
    return [{
        'Authorization': `Bearer ${entitlements.data.accessToken}`,
        'X-Riot-Entitlements-JWT': entitlements.data.token,
        'X-Riot-ClientPlatform': `ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9`,
        'X-Riot-ClientVersion': version
    }, entitlements.data.subject]
}

async function getName(h, puui) {
    const url = `https://pd.${region}.a.pvp.net/name-service/v2/players`
    h["Content-Type"] = "application/json"
    const resp = await axios.put(url, [puui], {
        headers: h,
        httpsAgent: new https.Agent({
            rejectUnauthorized: false
        }),
    })
    return resp.data

}



getLockfile()
    .then(res => {
        const lockfileData = res
        const url = `localhost:${lockfileData.port}`

        getLocalHeaders(lockfileData.password)
            .then(localHeaders => {
                getHeaders(localHeaders, lockfileData.port)
                    .then(resp => {
                        let gameNames = {}
                        const headers = resp[0]
                        console.log(headers)
                        // local websocket server
                        const ws = new WebSocket(`wss://riot:${lockfileData.password}@${url}`, {
                            rejectUnauthorized: false
                        })

                        ws.onopen = () => {
                            ws.send("[5, \"OnJsonApiEvent\"]")
                            console.log("Connected to " + url)
                        }

                        ws.onmessage = message => {
                            if (message.data.length > 1) {
                                const messageJson = JSON.parse(message.data)[2]
                                // console.log("\x1b[34m", "New message: ", "\x1b[0m")
                                if (messageJson.uri.includes("/voice-chat/v3/sessions/valorant/") && messageJson.uri.includes("/participants/")) {
                                    console.dir(messageJson)
                                    if (document.getElementById(messageJson.data.name) !== null){
                                        let h2 = document.getElementById(messageJson.data.name + "text")
                                        h2.textContent = gameNames[messageJson.data.name] + " - " + messageJson.data.energy
                                    } else {
                                        let div = document.createElement('div')
                                        div.id = messageJson.data.name
                                        div.classList.add("title")
                                        // div.classList.add("is-info")
                                        let h2 = document.createElement('h2')
                                        h2.id = messageJson.data.name + "text"
                                        const section = document.getElementById("section")
                                        section.appendChild(div)
                                        div.appendChild(h2)
                                        getName(headers, messageJson.data.name)
                                            .then(name => {
                                                gameNames[messageJson.data.name] = name[0].GameName + "#" + name[0].TagLine
                                                h2.textContent =  gameNames[messageJson.data.name]  + " - " + messageJson.data.energy
                                            })

                                    }





                                }
                            }

                        }

                        ws.onerror = () => console.log("Error" + url)

                        ws.onclose = () => console.log("Disconnected from " + url)
                })
            })

    })


