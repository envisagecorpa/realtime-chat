#!/usr/bin/env node
/**
 * Manual Test Runner for Quickstart Scenarios
 * Tests the real-time chat application against running servers
 */

const io = require('socket.io-client');

const BACKEND_URL = 'http://localhost:3000';
const results = [];

function log(scenario, status, message) {
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏳';
  console.log(`${emoji} ${scenario}: ${message}`);
  results.push({ scenario, status, message });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Scenario 1: User Authentication & Room Join
async function testScenario1() {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const client = io(BACKEND_URL, { transports: ['websocket'] });

    client.on('connect', () => {
      log('Scenario 1.1', 'PASS', 'Connected to server');
      client.emit('authenticate', { username: 'alice' });
    });

    client.on('authenticated', (data) => {
      if (data.username === 'alice' && data.userId) {
        log('Scenario 1.2', 'PASS', `Authenticated as ${data.username} (userId: ${data.userId})`);
        client.emit('join_room', { roomName: 'general' });
      } else {
        log('Scenario 1.2', 'FAIL', 'Authentication response invalid');
      }
    });

    client.on('room_joined', (data) => {
      const loadTime = Date.now() - startTime;
      if (data.roomName === 'general' && Array.isArray(data.users) && Array.isArray(data.messages)) {
        log('Scenario 1.3', 'PASS', `Joined room "${data.roomName}" with ${data.users.length} users, ${data.messages.length} messages (${loadTime}ms)`);

        if (loadTime < 2000) {
          log('Scenario 1.4 (PR-002)', 'PASS', `Message history loaded in ${loadTime}ms < 2000ms`);
        } else {
          log('Scenario 1.4 (PR-002)', 'FAIL', `Message history took ${loadTime}ms > 2000ms`);
        }
      } else {
        log('Scenario 1.3', 'FAIL', 'Room join response invalid');
      }

      client.disconnect();
      resolve();
    });

    client.on('auth_error', (data) => {
      log('Scenario 1', 'FAIL', `Auth error: ${data.error}`);
      client.disconnect();
      resolve();
    });

    client.on('connect_error', (err) => {
      log('Scenario 1', 'FAIL', `Connection error: ${err.message}`);
      resolve();
    });
  });
}

// Scenario 2: Real-time Message Delivery
async function testScenario2() {
  return new Promise(async (resolve) => {
    const alice = io(BACKEND_URL, { transports: ['websocket'] });
    const bob = io(BACKEND_URL, { transports: ['websocket'] });
    let aliceReady = false;
    let bobReady = false;
    const startTime = Date.now();

    alice.on('connect', () => alice.emit('authenticate', { username: 'alice-msg' }));
    bob.on('connect', () => bob.emit('authenticate', { username: 'bob-msg' }));

    alice.on('authenticated', () => {
      alice.emit('join_room', { roomName: 'general' });
    });

    bob.on('authenticated', () => {
      bob.emit('join_room', { roomName: 'general' });
    });

    alice.on('room_joined', () => {
      aliceReady = true;
      checkBothReady();
    });

    bob.on('room_joined', () => {
      bobReady = true;
      checkBothReady();
    });

    function checkBothReady() {
      if (aliceReady && bobReady) {
        setTimeout(sendMessage, 100); // Small delay to ensure both are fully in room
      }
    }

    function sendMessage() {
      const msgStartTime = Date.now();

      alice.on('message_sent', (data) => {
        const confirmTime = Date.now() - msgStartTime;
        if (data.deliveryStatus === 'sent') {
          log('Scenario 2.1 (FR-012)', 'PASS', `Message sent confirmation in ${confirmTime}ms, status: ${data.deliveryStatus}`);
        } else {
          log('Scenario 2.1', 'FAIL', `Unexpected delivery status: ${data.deliveryStatus}`);
        }
      });

      bob.on('new_message', (data) => {
        const deliveryTime = Date.now() - msgStartTime;
        if (data.content === 'Hello, Bob!' && data.username === 'alice-msg') {
          log('Scenario 2.2 (FR-002)', 'PASS', `Bob received message in ${deliveryTime}ms from alice-msg`);

          if (deliveryTime < 1000) {
            log('Scenario 2.3 (PR-001)', 'PASS', `Message delivery in ${deliveryTime}ms < 1000ms`);
          } else {
            log('Scenario 2.3 (PR-001)', 'FAIL', `Message delivery ${deliveryTime}ms > 1000ms`);
          }

          alice.disconnect();
          bob.disconnect();
          resolve();
        } else {
          log('Scenario 2.2', 'FAIL', `Message content mismatch: ${JSON.stringify(data)}`);
          alice.disconnect();
          bob.disconnect();
          resolve();
        }
      });

      alice.on('error', (err) => {
        log('Scenario 2', 'FAIL', `Alice error: ${err.message || JSON.stringify(err)}`);
        alice.disconnect();
        bob.disconnect();
        resolve();
      });

      alice.emit('send_message', {
        content: 'Hello, Bob!',
        timestamp: Date.now()
      });
    }

    setTimeout(() => {
      alice.disconnect();
      bob.disconnect();
      log('Scenario 2', 'FAIL', 'Timeout waiting for message delivery');
      resolve();
    }, 5000);
  });
}

// Scenario 3: Presence Updates
async function testScenario3() {
  return new Promise((resolve) => {
    const alice = io(BACKEND_URL, { transports: ['websocket'] });
    const charlie = io(BACKEND_URL, { transports: ['websocket'] });

    alice.on('connect', () => alice.emit('authenticate', { username: 'alice-presence' }));
    alice.on('authenticated', () => alice.emit('join_room', { roomName: 'general' }));

    alice.on('room_joined', () => {
      // Alice is in room, now trigger Charlie's connection
      setTimeout(() => {
        charlie.on('connect', () => charlie.emit('authenticate', { username: 'charlie' }));

        charlie.on('authenticated', () => {
          const joinStartTime = Date.now();
          charlie.emit('join_room', { roomName: 'general' });

          alice.on('user_joined', (data) => {
            const presenceTime = Date.now() - joinStartTime;
            if (data.username === 'charlie') {
              log('Scenario 3.1', 'PASS', `Alice received user_joined for charlie in ${presenceTime}ms`);

              if (presenceTime < 500) {
                log('Scenario 3.2 (PR-003)', 'PASS', `Presence update in ${presenceTime}ms < 500ms`);
              } else {
                log('Scenario 3.2 (PR-003)', 'FAIL', `Presence update ${presenceTime}ms > 500ms`);
              }

              alice.disconnect();
              charlie.disconnect();
              resolve();
            }
          });
        });
      }, 100);
    });

    setTimeout(() => {
      alice.disconnect();
      charlie.disconnect();
      log('Scenario 3', 'FAIL', 'Timeout waiting for presence update');
      resolve();
    }, 3000);
  });
}

// Scenario 13: Security (Input Sanitization)
async function testScenario13() {
  return new Promise((resolve) => {
    const client = io(BACKEND_URL, { transports: ['websocket'] });

    client.on('connect', () => client.emit('authenticate', { username: 'security-test' }));
    client.on('authenticated', () => client.emit('join_room', { roomName: 'general' }));

    client.on('room_joined', () => {
      // Test XSS injection
      client.emit('send_message', {
        content: '<script>alert("XSS")</script>',
        timestamp: Date.now()
      });

      client.on('new_message', (data) => {
        if (data.content.includes('&lt;script&gt;') || !data.content.includes('<script>')) {
          log('Scenario 13.1 (SR-002)', 'PASS', 'HTML sanitized: script tags escaped or removed');
        } else {
          log('Scenario 13.1 (SR-002)', 'FAIL', 'XSS vulnerability: script tags not sanitized');
        }

        client.disconnect();
        resolve();
      });
    });

    setTimeout(() => {
      client.disconnect();
      log('Scenario 13', 'FAIL', 'Timeout');
      resolve();
    }, 3000);
  });
}

// Main test runner
async function runAllTests() {
  console.log('\n='.repeat(60));
  console.log('  QUICKSTART MANUAL TEST RUNNER');
  console.log('  Testing against: ' + BACKEND_URL);
  console.log('='.repeat(60) + '\n');

  await testScenario1();
  await sleep(500);

  await testScenario2();
  await sleep(500);

  await testScenario3();
  await sleep(500);

  await testScenario13();
  await sleep(500);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('  TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;

  console.log(`\n  Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`  Success Rate: ${((passed/total) * 100).toFixed(1)}%\n`);

  if (failed === 0) {
    console.log('  ✅ ALL TESTS PASSED!');
  } else {
    console.log('  ❌ Some tests failed. Review above for details.');
  }

  console.log('\n' + '='.repeat(60) + '\n');
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
