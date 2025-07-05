import express from 'express';
import cors from 'cors';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import { ScriptExecutionResult, ScriptDefinition, WebSocketMessage } from '../src/types';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected to WebSocket');
    
    ws.on('close', () => {
        console.log('Client disconnected from WebSocket');
    });
});

function broadcastToClients(data: WebSocketMessage): void {
    wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

interface ExecuteScriptRequest {
    scriptName: string;
    args?: string[];
}

app.post('/api/execute-script', (req: express.Request<{}, ScriptExecutionResult, ExecuteScriptRequest>, res: express.Response<ScriptExecutionResult>) => {
    const { scriptName, args = [] } = req.body;
    
    const allowedScripts = [
    'balance_check.ts', 
    'transaction_sender.ts', 
    'contract_interaction.ts',
    'call-read.ts',
    'call-write.ts',
    'contract-deploy.ts',
    'batch-execute.ts'
];
    if (!allowedScripts.includes(scriptName)) {
        res.status(400).json({ 
            scriptName,
            args,
            exitCode: 1,
            output: '',
            error: 'Invalid script name',
            timestamp: new Date().toISOString()
        });
        return;
    }

    // テンプレートスクリプトと従来スクリプトの両方をサポート
    const isTemplateScript = ['call-read.ts', 'call-write.ts', 'contract-deploy.ts', 'batch-execute.ts'].includes(scriptName);
    const scriptPath = isTemplateScript 
        ? path.join(__dirname, '..', 'templates', scriptName)
        : path.join(__dirname, '..', 'scripts', scriptName);
    
    const env = {
        ...process.env,
        HYPEREVM_RPC_URL: process.env.HYPEREVM_RPC_URL || 'http://localhost:8545',
        PRIVATE_KEY: process.env.PRIVATE_KEY
    };
    
    const child: ChildProcess = spawn('ts-node', [scriptPath, ...args], { env });

    let output = '';
    let errorOutput = '';

    child.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
        errorOutput += data.toString();
    });

    child.on('close', (code: number | null) => {
        const result: ScriptExecutionResult = {
            scriptName,
            args,
            exitCode: code || 0,
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

app.get('/api/scripts', (_req: express.Request, res: express.Response<ScriptDefinition[]>) => {
    const scripts: ScriptDefinition[] = [
        // 従来のスクリプト
        {
            name: 'balance_check.ts',
            description: 'アドレスの残高を確認する',
            parameters: ['address1', 'address2...']
        },
        {
            name: 'transaction_sender.ts',
            description: 'トランザクションを送信する',
            parameters: ['to_address', 'value_in_ether']
        },
        {
            name: 'contract_interaction.ts',
            description: 'スマートコントラクトと相互作用する',
            parameters: ['contract_address', 'method', 'params...']
        },
        // 汎用テンプレートスクリプト
        {
            name: 'call-read.ts',
            description: '汎用コントラクトREAD関数を実行',
            parameters: ['--abi=path', '--address=0x...', '--function=name', '--args=...']
        },
        {
            name: 'call-write.ts',
            description: '汎用コントラクトWRITE関数を実行',
            parameters: ['--abi=path', '--address=0x...', '--function=name', '--args=...', '--gas-limit=...']
        },
        {
            name: 'contract-deploy.ts',
            description: 'コントラクトをデプロイ',
            parameters: ['--abi=path', '--bytecode=path', '--args=...']
        },
        {
            name: 'batch-execute.ts',
            description: 'バッチ実行（設定ファイル使用）',
            parameters: ['--config=path', '--stop-on-error']
        }
    ];
    
    res.json(scripts);
});

app.get('/', (_req: express.Request, res: express.Response) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(port, () => {
    console.log(`Dashboard server running on http://localhost:${port}`);
    console.log(`WebSocket server running on ws://localhost:8080`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        wss.close(() => {
            console.log('Process terminated');
        });
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        wss.close(() => {
            console.log('Process terminated');
        });
    });
});