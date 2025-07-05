# Hyperevm Chain Tools デプロイメント設計書

## 1. デプロイメント概要

Hyperevm Chain Toolsのデプロイメント戦略とインフラストラクチャ設計について説明します。

## 2. デプロイメント環境

### 2.1 環境分類

#### 2.1.1 開発環境 (Development)
- **目的**: 開発・テスト用
- **RPC**: ローカルまたはテストネット
- **ログレベル**: DEBUG
- **セキュリティ**: 最小限

#### 2.1.2 ステージング環境 (Staging)
- **目的**: 本番前検証
- **RPC**: テストネット
- **ログレベル**: INFO
- **セキュリティ**: 本番同等

#### 2.1.3 本番環境 (Production)
- **目的**: 実運用
- **RPC**: Hyperevm メインネット
- **ログレベル**: WARN/ERROR
- **セキュリティ**: 最大限

### 2.2 環境変数設定

#### 2.2.1 共通設定

```env
# アプリケーション設定
NODE_ENV=production
PORT=3000

# ブロックチェーン設定
HYPEREVM_RPC_URL=https://rpc.hyperliquid.xyz/evm
CHAIN_ID=999

# セキュリティ設定
PRIVATE_KEY=0x...
```

#### 2.2.2 環境別設定

**開発環境**
```env
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
HYPEREVM_RPC_URL=http://localhost:8545
```

**本番環境**
```env
NODE_ENV=production
PORT=3000
LOG_LEVEL=warn
HYPEREVM_RPC_URL=https://rpc.hyperliquid.xyz/evm
ENABLE_CORS=false
```

## 3. インフラストラクチャ設計

### 3.1 アーキテクチャ図

```
┌─────────────────────────────────────────────────┐
│                Load Balancer                    │
│                 (Nginx/HAProxy)                 │
└─────────────────────┬───────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
    ┌────▼────┐               ┌────▼────┐
    │ App     │               │ App     │
    │ Server  │               │ Server  │
    │ Node 1  │               │ Node 2  │
    └────┬────┘               └────┬────┘
         │                         │
         └────────────┬────────────┘
                      │
    ┌─────────────────▼─────────────────┐
    │            Monitoring             │
    │       (Prometheus/Grafana)        │
    └───────────────────────────────────┘
```

### 3.2 コンポーネント構成

#### 3.2.1 アプリケーションサーバー
- **Runtime**: Node.js 18+
- **Process Manager**: PM2
- **Memory**: 512MB以上
- **CPU**: 1 Core以上

#### 3.2.2 ロードバランサー
- **Software**: Nginx
- **SSL/TLS**: Let's Encrypt
- **Rate Limiting**: 100 requests/minute

#### 3.2.3 監視システム
- **Metrics**: Prometheus
- **Visualization**: Grafana
- **Alerting**: AlertManager

## 4. デプロイメント戦略

### 4.1 ブルーグリーンデプロイメント

```bash
# 1. 新バージョンをブルー環境にデプロイ
deploy-blue.sh

# 2. ヘルスチェック
health-check.sh blue

# 3. トラフィックを切り替え
switch-traffic.sh blue

# 4. グリーン環境をクリーンアップ
cleanup-green.sh
```

### 4.2 ローリングデプロイメント

```bash
# 1. 1台ずつ更新
for server in server1 server2 server3; do
    echo "Updating $server..."
    ssh $server "cd /app && git pull && npm install && pm2 restart all"
    health-check.sh $server
    sleep 30
done
```

## 5. Docker化

### 5.1 Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 依存関係のインストール
COPY package*.json ./
RUN npm ci --only=production

# アプリケーションコードのコピー
COPY . .

# ユーザーの作成
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# 権限設定
RUN chown -R nodejs:nodejs /app
USER nodejs

# ポート公開
EXPOSE 3000 8080

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# 起動コマンド
CMD ["node", "dashboard/server.js"]
```

### 5.2 docker-compose.yml

```yaml
version: '3.8'

services:
  hevm-tool:
    build: .
    ports:
      - "3000:3000"
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - HYPEREVM_RPC_URL=${HYPEREVM_RPC_URL}
      - PRIVATE_KEY=${PRIVATE_KEY}
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - hevm-tool
    restart: unless-stopped
    
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    restart: unless-stopped
    
  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-storage:/var/lib/grafana
    restart: unless-stopped

volumes:
  grafana-storage:
```

## 6. CI/CD パイプライン

### 6.1 GitHub Actions

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    - name: Install dependencies
      run: npm ci
    - name: Run tests
      run: npm test
    - name: Run linter
      run: npm run lint
      
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Build Docker image
      run: |
        docker build -t hevm-tool:${{ github.sha }} .
        docker tag hevm-tool:${{ github.sha }} hevm-tool:latest
    - name: Push to registry
      run: |
        echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
        docker push hevm-tool:${{ github.sha }}
        docker push hevm-tool:latest
        
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
    - name: Deploy to production
      run: |
        ssh ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} "
          cd /app &&
          docker-compose pull &&
          docker-compose down &&
          docker-compose up -d
        "
```

### 6.2 デプロイスクリプト

```bash
#!/bin/bash
# deploy.sh

set -e

# 環境変数の設定
export NODE_ENV=production
export PORT=3000

# 依存関係のインストール
npm ci --only=production

# アプリケーションの停止
pm2 stop all || true

# アプリケーションの起動
pm2 start ecosystem.config.js --env production

# ヘルスチェック
./scripts/health-check.sh

echo "Deployment completed successfully!"
```

## 7. 監視とログ

### 7.1 アプリケーション監視

```javascript
// healthcheck.js
const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  // ヘルスチェックロジック
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV
  };
  
  res.json(health);
});

app.listen(3001, () => {
  console.log('Health check server running on port 3001');
});
```

### 7.2 ログ設定

```javascript
// logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

module.exports = logger;
```

## 8. セキュリティ設定

### 8.1 Nginx設定

```nginx
server {
    listen 80;
    server_name hevm-tool.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name hevm-tool.example.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # セキュリティヘッダー
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
    }
    
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 8.2 PM2設定

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'hevm-tool',
    script: 'dashboard/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: 'logs/combined.log',
    out_file: 'logs/out.log',
    error_file: 'logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '1G',
    watch: false,
    ignore_watch: ['node_modules', 'logs']
  }]
};
```

## 9. バックアップ戦略

### 9.1 設定ファイルバックアップ

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backup/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# アプリケーション設定
cp -r /app/.env $BACKUP_DIR/
cp -r /app/docs $BACKUP_DIR/
cp -r /app/logs $BACKUP_DIR/

# システム設定
cp /etc/nginx/nginx.conf $BACKUP_DIR/
cp /etc/systemd/system/hevm-tool.service $BACKUP_DIR/

# 圧縮
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
rm -rf $BACKUP_DIR

echo "Backup completed: $BACKUP_DIR.tar.gz"
```

### 9.2 復元手順

```bash
#!/bin/bash
# restore.sh

BACKUP_FILE=$1
if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: restore.sh <backup_file>"
    exit 1
fi

# アプリケーション停止
pm2 stop all

# バックアップファイルの展開
tar -xzf $BACKUP_FILE -C /tmp

# 設定ファイルの復元
cp /tmp/backup/.env /app/
cp /tmp/backup/nginx.conf /etc/nginx/

# アプリケーション再起動
pm2 start all

echo "Restore completed"
```

## 10. 運用手順

### 10.1 定期メンテナンス

```bash
# 毎日実行
0 2 * * * /app/scripts/daily-maintenance.sh

# 毎週実行
0 3 * * 0 /app/scripts/weekly-maintenance.sh
```

### 10.2 障害対応

```bash
# 1. 状態確認
pm2 status
systemctl status nginx
docker ps

# 2. ログ確認
pm2 logs
tail -f /var/log/nginx/error.log

# 3. 再起動
pm2 restart all
systemctl restart nginx

# 4. ヘルスチェック
curl -f http://localhost:3000/health
```