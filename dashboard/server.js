const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
    ws.on('close', () => {
        console.log('Client disconnected from WebSocket');
    });
});

function broadcastToClients(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

app.post('/api/execute-script', (req, res) => {
    const { scriptName, args = [] } = req.body;
    
    const allowedScripts = ['balance_check.js', 'transaction_sender.js', 'contract_interaction.js'];
    if (!allowedScripts.includes(scriptName)) {
        return res.status(400).json({ error: 'Invalid script name' });
    }

    const scriptPath = path.join(__dirname, '..', 'scripts', scriptName);
    
    const env = {
        ...process.env,
        HYPEREVM_RPC_URL: process.env.HYPEREVM_RPC_URL || 'http://localhost:8545',
        PRIVATE_KEY: process.env.PRIVATE_KEY
    };
    
    const child = spawn('node', [scriptPath, ...args], { env });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
        output += data.toString();
    });

    child.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });

    child.on('close', (code) => {
        const result = {
            scriptName,
            args,
            exitCode: code,
            output: output.trim(),
            error: errorOutput.trim(),
            timestamp: new Date().toISOString()
        };

        broadcastToClients({
            type: 'script_execution',
            data: result
        });

        res.json(result);
    });
});

app.get('/api/scripts', (req, res) => {
    const scripts = [
        {
            name: 'balance_check.js',
            description: 'アドレスの残高を確認する',
            parameters: ['address1', 'address2...']
        },
        {
            name: 'transaction_sender.js',
            description: 'トランザクションを送信する',
            parameters: ['to_address', 'value_in_ether']
        },
        {
            name: 'contract_interaction.js',
            description: 'スマートコントラクトと相互作用する',
            parameters: ['contract_address', 'method', 'params...']
        }
    ];
    
    res.json(scripts);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Dashboard server running on http://localhost:${port}`);
    console.log(`WebSocket server running on ws://localhost:8080`);
});