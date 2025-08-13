/**
 * BROTHERHOOD 릴레이 디스커버리 서비스
 * 
 * 역할:
 * 1. 릴레이 노드들의 등록 및 관리
 * 2. 클라이언트와 검증자에게 최적의 릴레이 노드 추천
 * 3. 릴레이 노드 상태 모니터링
 * 4. 네트워크 토폴로지 관리
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

class RelayDiscoveryService {
  constructor(port = 3333) {
    this.port = port;
    this.relayNodes = new Map(); // nodeId -> nodeInfo
    this.healthCheckInterval = 60000; // 1분
    this.nodeTimeoutMs = 300000; // 5분
    
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.startHealthChecker();
    
    console.log('🔍 BROTHERHOOD 릴레이 디스커버리 서비스 초기화됨');
  }
  
  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    
    // 로깅 미들웨어
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }
  
  setupRoutes() {
    // 릴레이 노드 등록
    this.app.post('/api/register-relay', (req, res) => {
      try {
        const nodeInfo = req.body;
        const { nodeId, name, region, publicIP, port, status, capabilities, version } = nodeInfo;
        
        if (!nodeId || !name || !publicIP || !port) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: nodeId, name, publicIP, port'
          });
        }
        
        const registrationTime = Date.now();
        const fullNodeInfo = {
          ...nodeInfo,
          registeredAt: registrationTime,
          lastHeartbeat: registrationTime,
          endpoint: `ws://${publicIP}:${port}`,
          score: this.calculateInitialScore(nodeInfo),
          connections: 0,
          reliability: 1.0
        };
        
        this.relayNodes.set(nodeId, fullNodeInfo);
        
        console.log(`✅ 릴레이 노드 등록: ${name} (${nodeId}) - ${publicIP}:${port}`);
        
        res.json({
          success: true,
          nodeId: nodeId,
          message: 'Relay node registered successfully',
          discoveryInfo: {
            heartbeatInterval: this.healthCheckInterval,
            timeoutMs: this.nodeTimeoutMs
          }
        });
        
      } catch (error) {
        console.error('❌ 릴레이 노드 등록 실패:', error.message);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    });
    
    // 릴레이 노드 하트비트
    this.app.post('/api/heartbeat/:nodeId', (req, res) => {
      const { nodeId } = req.params;
      const { status, connections, stats } = req.body;
      
      if (!this.relayNodes.has(nodeId)) {
        return res.status(404).json({
          success: false,
          error: 'Relay node not found'
        });
      }
      
      const nodeInfo = this.relayNodes.get(nodeId);
      nodeInfo.lastHeartbeat = Date.now();
      nodeInfo.status = status || nodeInfo.status;
      nodeInfo.connections = connections || nodeInfo.connections;
      
      if (stats) {
        nodeInfo.stats = stats;
        nodeInfo.score = this.calculateNodeScore(nodeInfo);
      }
      
      this.relayNodes.set(nodeId, nodeInfo);
      
      res.json({
        success: true,
        message: 'Heartbeat received',
        score: nodeInfo.score
      });
    });
    
    // 최적의 릴레이 노드 추천
    this.app.get('/api/discover-relay', (req, res) => {
      const { region, connectionType, excludeNodes } = req.query;
      const excludeList = excludeNodes ? excludeNodes.split(',') : [];
      
      const availableNodes = this.getAvailableNodes(region, excludeList);
      const recommendedNodes = this.rankNodesByScore(availableNodes).slice(0, 3);
      
      console.log(`🔍 릴레이 추천 요청: ${recommendedNodes.length}개 노드 반환 (지역: ${region || 'any'})`);
      
      res.json({
        success: true,
        recommendedRelays: recommendedNodes.map(node => ({
          nodeId: node.nodeId,
          name: node.name,
          region: node.region,
          endpoint: node.endpoint,
          score: node.score,
          connections: node.connections,
          reliability: node.reliability,
          capabilities: node.capabilities
        })),
        totalAvailable: availableNodes.length
      });
    });
    
    // 네트워크 상태 조회
    this.app.get('/api/network-status', (req, res) => {
      const nodes = Array.from(this.relayNodes.values());
      const activeNodes = nodes.filter(node => this.isNodeAlive(node));
      
      const regions = {};
      activeNodes.forEach(node => {
        if (!regions[node.region]) {
          regions[node.region] = 0;
        }
        regions[node.region]++;
      });
      
      res.json({
        success: true,
        network: {
          totalNodes: nodes.length,
          activeNodes: activeNodes.length,
          regionDistribution: regions,
          totalConnections: activeNodes.reduce((sum, node) => sum + (node.connections || 0), 0),
          avgReliability: activeNodes.reduce((sum, node) => sum + node.reliability, 0) / activeNodes.length || 0,
          uptime: Date.now() - this.startTime
        },
        nodes: activeNodes.map(node => ({
          nodeId: node.nodeId,
          name: node.name,
          region: node.region,
          status: node.status,
          connections: node.connections,
          score: node.score,
          reliability: node.reliability,
          uptime: Date.now() - node.registeredAt
        }))
      });
    });
    
    // 특정 릴레이 노드 정보
    this.app.get('/api/relay/:nodeId', (req, res) => {
      const { nodeId } = req.params;
      
      if (!this.relayNodes.has(nodeId)) {
        return res.status(404).json({
          success: false,
          error: 'Relay node not found'
        });
      }
      
      const nodeInfo = this.relayNodes.get(nodeId);
      res.json({
        success: true,
        node: {
          ...nodeInfo,
          isAlive: this.isNodeAlive(nodeInfo),
          uptime: Date.now() - nodeInfo.registeredAt
        }
      });
    });
    
    // 릴레이 노드 제거
    this.app.delete('/api/relay/:nodeId', (req, res) => {
      const { nodeId } = req.params;
      
      if (this.relayNodes.has(nodeId)) {
        const nodeInfo = this.relayNodes.get(nodeId);
        this.relayNodes.delete(nodeId);
        
        console.log(`🗑️ 릴레이 노드 제거: ${nodeInfo.name} (${nodeId})`);
        
        res.json({
          success: true,
          message: 'Relay node removed'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Relay node not found'
        });
      }
    });
    
    // 상태 확인
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'relay-discovery',
        version: '1.0.0',
        uptime: Date.now() - this.startTime,
        registeredNodes: this.relayNodes.size
      });
    });
  }
  
  calculateInitialScore(nodeInfo) {
    let score = 100; // 기본 점수
    
    // 지역별 가산점
    if (nodeInfo.region === 'korea') score += 10;
    if (nodeInfo.region === 'asia') score += 5;
    
    // 기능별 가산점
    if (nodeInfo.capabilities && nodeInfo.capabilities.includes('transaction_relay')) score += 10;
    if (nodeInfo.capabilities && nodeInfo.capabilities.includes('block_relay')) score += 10;
    
    return score;
  }
  
  calculateNodeScore(nodeInfo) {
    let score = this.calculateInitialScore(nodeInfo);
    
    // 연결 수에 따른 조정 (너무 많으면 감점)
    const connectionRatio = nodeInfo.connections / (nodeInfo.maxConnections || 1000);
    if (connectionRatio > 0.8) score -= 20;
    else if (connectionRatio > 0.6) score -= 10;
    else if (connectionRatio < 0.3) score += 10;
    
    // 신뢰성에 따른 조정
    score *= nodeInfo.reliability;
    
    // 업타임에 따른 조정
    const uptimeHours = (Date.now() - nodeInfo.registeredAt) / (1000 * 60 * 60);
    if (uptimeHours > 24) score += 5;
    if (uptimeHours > 168) score += 10; // 1주일 이상
    
    return Math.round(score);
  }
  
  getAvailableNodes(region, excludeList = []) {
    const nodes = Array.from(this.relayNodes.values());
    
    return nodes.filter(node => {
      // 제외 목록 확인
      if (excludeList.includes(node.nodeId)) return false;
      
      // 살아있는 노드만
      if (!this.isNodeAlive(node)) return false;
      
      // 지역 필터
      if (region && node.region !== region) return false;
      
      // 연결 가능한 상태인지 확인
      if (node.status !== 'running') return false;
      
      return true;
    });
  }
  
  rankNodesByScore(nodes) {
    return nodes.sort((a, b) => b.score - a.score);
  }
  
  isNodeAlive(nodeInfo) {
    const timeSinceLastHeartbeat = Date.now() - nodeInfo.lastHeartbeat;
    return timeSinceLastHeartbeat < this.nodeTimeoutMs;
  }
  
  startHealthChecker() {
    setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckInterval);
    
    console.log(`💓 헬스체커 시작 (${this.healthCheckInterval}ms 간격)`);
  }
  
  performHealthCheck() {
    const currentTime = Date.now();
    const deadNodes = [];
    
    this.relayNodes.forEach((nodeInfo, nodeId) => {
      if (!this.isNodeAlive(nodeInfo)) {
        deadNodes.push({ nodeId, nodeInfo });
      }
    });
    
    // 죽은 노드들 제거
    deadNodes.forEach(({ nodeId, nodeInfo }) => {
      this.relayNodes.delete(nodeId);
      console.log(`💀 비활성 릴레이 노드 제거: ${nodeInfo.name} (${nodeId})`);
    });
    
    const activeCount = this.relayNodes.size;
    if (deadNodes.length > 0) {
      console.log(`🏥 헬스체크 완료: ${deadNodes.length}개 노드 제거, ${activeCount}개 노드 활성`);
    }
  }
  
  start() {
    this.startTime = Date.now();
    
    this.app.listen(this.port, () => {
      console.log(`\n🔍 BROTHERHOOD 릴레이 디스커버리 서비스 시작!`);
      console.log(`🌐 서버 주소: http://localhost:${this.port}`);
      console.log(`📊 네트워크 상태: http://localhost:${this.port}/api/network-status`);
      console.log(`🏥 헬스체크: http://localhost:${this.port}/health`);
      console.log(`\n💡 릴레이 노드들이 이 서비스에 등록됩니다.`);
    });
  }
}

// CLI 실행
if (require.main === module) {
  const port = process.argv[2] ? parseInt(process.argv[2]) : 3333;
  const discoveryService = new RelayDiscoveryService(port);
  discoveryService.start();
}

module.exports = RelayDiscoveryService;



