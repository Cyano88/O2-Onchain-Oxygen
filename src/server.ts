/**
 * server.ts — O2 Metabolic Agent MCP Server
 *
 * Exposes two tools via the Model Context Protocol:
 *   • get_metabolic_status    — check OKB gas vitals + harvestable yield
 *   • execute_refuel_cycle    — harvest LP fees, swap to OKB, refuel wallet
 *
 * Standard: MCP (Model Context Protocol) via @modelcontextprotocol/sdk
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import 'dotenv/config';

import { getMetabolicStatus } from './metabolic/status.js';
import { executeRefuelCycle }  from './metabolic/refuel.js';

// ─── Tool Input Schemas ───────────────────────────────────────────────────────

const GetMetabolicStatusSchema = z.object({
  agentAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'Must be a valid Ethereum address')
    .describe('The agent wallet address on X Layer to inspect'),
});

const ExecuteRefuelCycleSchema = z.object({
  agentAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .describe('The agent wallet address executing the refuel'),
  targetPositionId: z
    .string()
    .describe('Uniswap V3 or V4 position NFT token ID to harvest fees from'),
  protocol: z
    .enum(['v3', 'v4'])
    .describe('Which Uniswap protocol holds the target position'),
  slippageTolerance: z
    .number()
    .min(0.01)
    .max(50)
    .optional()
    .default(0.5)
    .describe('Swap slippage tolerance in percent (default: 0.5%)'),
  deadline: z
    .number()
    .optional()
    .describe('UNIX timestamp deadline for the swap (default: now + 20 min)'),
});

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: 'get_metabolic_status',
    description:
      'Check the agent\'s metabolic health: current OKB gas balance on X Layer, ' +
      'gas health percentage, and all Uniswap V3/V4 liquidity positions with ' +
      'harvestable fee balances. Returns a recommendation on whether a refuel cycle ' +
      'should be triggered.',
    inputSchema: {
      type: 'object',
      properties: {
        agentAddress: {
          type: 'string',
          description: 'The agent wallet address on X Layer to inspect',
          pattern: '^0x[0-9a-fA-F]{40}$',
        },
      },
      required: ['agentAddress'],
    },
  },
  {
    name: 'execute_refuel_cycle',
    description:
      'Execute a full O2 metabolic refuel cycle: ' +
      '(1) Run Profitability Guard to verify harvest value > gas cost × 1.5. ' +
      '(2) Collect accumulated fees from the target Uniswap V3 or V4 position NFT. ' +
      '(3) Swap harvested tokens to OKB via OKX OnchainOS DEX aggregator. ' +
      '(4) Return transaction hashes and an OKLink explorer URL for on-chain verification.',
    inputSchema: {
      type: 'object',
      properties: {
        agentAddress: {
          type: 'string',
          description: 'The agent wallet address executing the refuel',
          pattern: '^0x[0-9a-fA-F]{40}$',
        },
        targetPositionId: {
          type: 'string',
          description: 'Uniswap V3 or V4 position NFT token ID to harvest fees from',
        },
        protocol: {
          type: 'string',
          enum: ['v3', 'v4'],
          description: 'Which Uniswap protocol holds the target position',
        },
        slippageTolerance: {
          type: 'number',
          description: 'Swap slippage tolerance in percent (default: 0.5%)',
          default: 0.5,
        },
        deadline: {
          type: 'number',
          description: 'UNIX timestamp deadline for the swap (default: now + 20 min)',
        },
      },
      required: ['agentAddress', 'targetPositionId', 'protocol'],
    },
  },
];

// ─── Server Bootstrap ─────────────────────────────────────────────────────────

const server = new Server(
  {
    name: 'o2-metabolic-agent',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// ─── List Tools Handler ───────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// ─── Call Tool Handler ────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    // ── get_metabolic_status ──────────────────────────────────────────────
    case 'get_metabolic_status': {
      const input = GetMetabolicStatusSchema.parse(args);

      try {
        const status = await getMetabolicStatus(input.agentAddress);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ...status,
                  // Stringify BigInt fields for JSON serialisation
                  v3Positions: status.v3Positions.map((p) => ({
                    ...p,
                    tokenId:    p.tokenId.toString(),
                    liquidity:  p.liquidity.toString(),
                    tokensOwed0: p.tokensOwed0.toString(),
                    tokensOwed1: p.tokensOwed1.toString(),
                  })),
                  v4Positions: status.v4Positions.map((p) => ({
                    ...p,
                    tokenId:    p.tokenId.toString(),
                    liquidity:  p.liquidity.toString(),
                    tokensOwed0: p.tokensOwed0.toString(),
                    tokensOwed1: p.tokensOwed1.toString(),
                  })),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text', text: `Metabolic status check failed: ${message}` }],
        };
      }
    }

    // ── execute_refuel_cycle ──────────────────────────────────────────────
    case 'execute_refuel_cycle': {
      const input = ExecuteRefuelCycleSchema.parse(args);

      try {
        const result = await executeRefuelCycle(input);

        if (!result.success) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: result.error,
                    profitabilityReport: result.profitabilityReport,
                    currentBalance: result.newBalance,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  harvestTxHash: result.harvestTxHash,
                  swapTxHash: result.swapTxHash,
                  explorerUrl: result.explorerUrl,
                  okbReceived: result.okbReceived,
                  newBalance: result.newBalance,
                  profitabilityReport: result.profitabilityReport,
                  message: `Refuel complete. OKB balance updated to ${result.newBalance}. Verify: ${result.explorerUrl}`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text', text: `Refuel cycle failed: ${message}` }],
        };
      }
    }

    default:
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      };
  }
});

// ─── Transport & Start ────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[O2] Metabolic Agent MCP Server running on stdio');
  console.error(`[O2] Network: X Layer (Chain ${process.env.X_LAYER_CHAIN_ID ?? 195})`);
  console.error(`[O2] Min gas threshold: ${process.env.MIN_GAS_THRESHOLD ?? '0.05'} OKB`);
}

main().catch((err) => {
  console.error('[O2] Fatal error:', err);
  process.exit(1);
});
