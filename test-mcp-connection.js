#!/usr/bin/env node

/**
 * Test MCP connection like Windsurf does
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

async function testMCPConnection() {
  console.log('Testing MCP connection...');
  
  const child = spawn('node', ['bin/claudepoint.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  // Send MCP initialization message
  const initMessage = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: {
          listChanged: true
        }
      },
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  };

  let response = '';
  let errorOutput = '';

  child.stdout.on('data', (data) => {
    response += data.toString();
    console.log('STDOUT:', data.toString());
  });

  child.stderr.on('data', (data) => {
    errorOutput += data.toString();
    console.log('STDERR:', data.toString());
  });

  child.on('close', (code) => {
    console.log(`Child process exited with code ${code}`);
    console.log('Final response:', response);
    console.log('Final error output:', errorOutput);
  });

  child.on('error', (error) => {
    console.error('Child process error:', error);
  });

  // Wait a bit for the server to start
  await setTimeout(1000);

  // Send the initialization message
  console.log('Sending initialization message...');
  child.stdin.write(JSON.stringify(initMessage) + '\n');

  // Wait for response
  await setTimeout(2000);

  // Send tools list request
  const toolsMessage = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  };

  console.log('Sending tools list request...');
  child.stdin.write(JSON.stringify(toolsMessage) + '\n');

  // Wait for response
  await setTimeout(2000);

  // Clean up
  child.kill();
}

testMCPConnection().catch(console.error);