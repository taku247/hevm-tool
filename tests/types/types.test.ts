import {
  BalanceResult,
  TransactionResult,
  ContractCallResult,
  ScriptExecutionResult,
  ScriptDefinition,
  WebSocketMessage
} from '../../src/types';

describe('Type Definitions', () => {
  describe('BalanceResult', () => {
    it('should accept valid success result', () => {
      const result: BalanceResult = {
        success: true,
        address: '0x1234567890123456789012345678901234567890',
        balance: '1.0',
        balanceWei: '1000000000000000000',
        timestamp: '2023-12-01T12:00:00.000Z'
      };

      expect(result.success).toBe(true);
      expect(result.address).toBeDefined();
      expect(result.balance).toBeDefined();
      expect(result.balanceWei).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should accept valid error result', () => {
      const result: BalanceResult = {
        success: false,
        address: '0x1234567890123456789012345678901234567890',
        error: 'Network error',
        timestamp: '2023-12-01T12:00:00.000Z'
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('TransactionResult', () => {
    it('should accept valid success result', () => {
      const result: TransactionResult = {
        success: true,
        transactionHash: '0xabcdef1234567890',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '1.0',
        gasUsed: '21000',
        timestamp: '2023-12-01T12:00:00.000Z'
      };

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBeDefined();
      expect(result.from).toBeDefined();
      expect(result.to).toBeDefined();
      expect(result.value).toBeDefined();
    });

    it('should accept valid error result', () => {
      const result: TransactionResult = {
        success: false,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '1.0',
        error: 'Insufficient funds',
        timestamp: '2023-12-01T12:00:00.000Z'
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('ContractCallResult', () => {
    it('should accept valid read result', () => {
      const result: ContractCallResult = {
        success: true,
        contractAddress: '0xcontract123456789012345678901234567890',
        method: 'balanceOf',
        parameters: ['0x1234567890123456789012345678901234567890'],
        result: '1000000000000000000',
        transactionHash: null,
        timestamp: '2023-12-01T12:00:00.000Z'
      };

      expect(result.success).toBe(true);
      expect(result.contractAddress).toBeDefined();
      expect(result.method).toBeDefined();
      expect(result.parameters).toBeInstanceOf(Array);
    });

    it('should accept valid write result', () => {
      const result: ContractCallResult = {
        success: true,
        contractAddress: '0xcontract123456789012345678901234567890',
        method: 'transfer',
        parameters: ['0x1234567890123456789012345678901234567890', '1000000000000000000'],
        result: {},
        transactionHash: '0xtransaction123456789',
        timestamp: '2023-12-01T12:00:00.000Z'
      };

      expect(result.transactionHash).toBeDefined();
      expect(result.transactionHash).not.toBeNull();
    });
  });

  describe('ScriptExecutionResult', () => {
    it('should accept valid execution result', () => {
      const result: ScriptExecutionResult = {
        scriptName: 'balance_check.ts',
        args: ['0x1234567890123456789012345678901234567890'],
        exitCode: 0,
        output: 'Success',
        error: '',
        timestamp: '2023-12-01T12:00:00.000Z'
      };

      expect(result.scriptName).toBeDefined();
      expect(result.args).toBeInstanceOf(Array);
      expect(result.exitCode).toBeDefined();
      expect(result.output).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('WebSocketMessage', () => {
    it('should accept valid message', () => {
      const message: WebSocketMessage = {
        type: 'script_execution',
        data: {
          scriptName: 'balance_check.ts',
          args: ['0x1234567890123456789012345678901234567890'],
          exitCode: 0,
          output: 'Success',
          error: '',
          timestamp: '2023-12-01T12:00:00.000Z'
        }
      };

      expect(message.type).toBe('script_execution');
      expect(message.data).toBeDefined();
    });
  });

  describe('ScriptDefinition', () => {
    it('should accept valid script definition', () => {
      const script: ScriptDefinition = {
        name: 'balance_check.ts',
        description: 'Check address balance',
        parameters: ['address1', 'address2']
      };

      expect(script.name).toBeDefined();
      expect(script.description).toBeDefined();
      expect(script.parameters).toBeInstanceOf(Array);
    });
  });
});