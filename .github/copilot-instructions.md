# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

This is the **ioBroker.mclighting** adapter that connects to McLighting-compatible ESP8266 devices via WebSocket. McLighting is a popular RGB(W) LED strip controller firmware for ESP8266 microcontrollers that supports WS2812, WS2813, SK6812, and similar addressable LED strips. The adapter provides:

- WebSocket-based real-time communication with ESP8266 devices
- RGB/RGBW color control and brightness adjustment
- Animation/effect modes (static colors, rainbow, fade, etc.)
- Speed control for animations
- Power on/off functionality
- Real-time status updates and connection monitoring

Key technical aspects:
- Uses `ws` library for WebSocket connections
- Handles JSON message protocols for device communication
- Manages connection timeouts and reconnection logic
- Processes color data in various formats (hex, RGB values)
- Supports range-based LED control for individual LED segments

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();
                        
                        // Get adapter object using promisified pattern
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });
                        
                        if (!obj) {
                            return reject(new Error('Adapter object not found'));
                        }

                        // Configure adapter properties
                        Object.assign(obj.native, {
                            position: TEST_COORDINATES,
                            createCurrently: true,
                            createHourly: true,
                            createDaily: true,
                            // Add other configuration as needed
                        });

                        // Set the updated configuration
                        harness.objects.setObject(obj._id, obj);

                        console.log('✅ Step 1: Configuration written, starting adapter...');
                        
                        // Start adapter and wait
                        await harness.startAdapterAndWait();
                        
                        console.log('✅ Step 2: Adapter started');

                        // Wait for adapter to process data
                        const waitMs = 15000;
                        await wait(waitMs);

                        console.log('🔍 Step 3: Checking states after adapter run...');
                        
                        // Check if essential states are created
                        const connectionState = await harness.states.getStateAsync('your-adapter.0.info.connection');
                        
                        if (!connectionState) {
                            return reject(new Error('Expected connection state to be created'));
                        }
                        
                        resolve();
                        
                    } catch (error) {
                        console.error('Integration test failed:', error);
                        reject(error);
                    }
                });
            }).timeout(60000);
        });
    }
});
```

#### WebSocket Testing for McLighting Adapter

For WebSocket-based adapters like McLighting, integration tests should include:

```javascript
// Test WebSocket connection handling
it('should handle WebSocket connection properly', async function () {
    const config = {
        host: '192.168.1.100', // Mock ESP8266 IP
        port: 81               // McLighting default port
    };
    
    // Configure adapter
    await harness.changeAdapterConfig('mclighting', {
        native: config
    });
    
    // Start adapter (will attempt connection)
    await harness.startAdapter();
    
    // Wait for connection attempt
    await wait(5000);
    
    // Check connection state (may be false if no real device)
    const connectionState = await harness.states.getStateAsync('mclighting.0.info.connection');
    expect(connectionState).to.exist;
    
    // Verify other states are created
    const powerState = await harness.states.getStateAsync('mclighting.0.power');
    const colorState = await harness.states.getStateAsync('mclighting.0.color');
    const brightnessState = await harness.states.getStateAsync('mclighting.0.brightness');
    
    expect(powerState).to.exist;
    expect(colorState).to.exist;
    expect(brightnessState).to.exist;
}).timeout(30000);
```

## Code Style and Standards

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

### McLighting-Specific Standards
- Always handle WebSocket connection errors gracefully
- Implement proper timeout and reconnection logic for network connections
- Validate color values before sending to device (hex format, RGB range 0-255)
- Use appropriate state roles for different data types (level.dimmer for brightness, switch.light for power)
- Clear all timers and intervals in the unload() method to prevent memory leaks
- Log WebSocket communication at debug level for troubleshooting

### WebSocket Connection Best Practices
```javascript
// Example of proper WebSocket handling
function createConnection() {
    try {
        mclighting = new WebSocket(`ws://${adapter.config.host}:${adapter.config.port}`);
        
        mclighting.on('open', () => {
            adapter.log.info('Connected to McLighting device');
            adapter.setState('info.connection', true, true);
        });
        
        mclighting.on('error', (error) => {
            adapter.log.error(`WebSocket error: ${error.message}`);
            adapter.setState('info.connection', false, true);
        });
        
        mclighting.on('close', () => {
            adapter.log.info('Connection closed');
            adapter.setState('info.connection', false, true);
            // Implement reconnection logic here
        });
        
    } catch (error) {
        adapter.log.error(`Failed to create WebSocket connection: ${error.message}`);
        adapter.setState('info.connection', false, true);
    }
}
```

## Code Style and Standards

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

## Adapter Architecture

### Key Components
1. **WebSocket Communication**: Real-time bidirectional communication with ESP8266
2. **State Management**: ioBroker state objects for device control and status
3. **Message Protocol**: JSON-based command structure for McLighting firmware
4. **Connection Management**: Automatic reconnection and timeout handling
5. **Color Processing**: Support for various color formats (hex, RGB components)

### State Structure
The adapter creates these main states:
- `info.connection` - Connection status indicator
- `power` - On/off control (boolean)
- `brightness` - LED brightness 0-255 (number)
- `color` - RGB color in hex format (string)
- `color_R`, `color_G`, `color_B` - Individual RGB components (numbers)
- `fx_mode` - Animation mode number (number)
- `fx_mode_name` - Current animation name (string)
- `speed` - Animation speed 0-255 (number)
- `mode` - Manual mode commands (string)
- `list_modes` - Available animation modes (array)

## CI/CD and Testing Integration

### GitHub Actions for API Testing
For adapters with external API dependencies, implement separate CI/CD jobs:

```yaml
# Tests API connectivity with demo credentials (runs separately)
demo-api-tests:
  if: contains(github.event.head_commit.message, '[skip ci]') == false
  
  runs-on: ubuntu-22.04
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run demo API tests
      run: npm run test:integration-demo
```

### CI/CD Best Practices
- Run credential tests separately from main test suite
- Use ubuntu-22.04 for consistency
- Don't make credential tests required for deployment
- Provide clear failure messages for API connectivity issues
- Use appropriate timeouts for external API calls (120+ seconds)

### Package.json Script Integration
Add dedicated script for credential testing:
```json
{
  "scripts": {
    "test:integration-demo": "mocha test/integration-demo --exit"
  }
}
```

### Practical Example: Complete API Testing Implementation
Here's a complete example based on lessons learned from the Discovergy adapter:

#### test/integration-demo.js
```javascript
const path = require("path");
const { tests } = require("@iobroker/testing");

// Helper function to encrypt password using ioBroker's encryption method
async function encryptPassword(harness, password) {
    const systemConfig = await harness.objects.getObjectAsync("system.config");
    
    if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
        throw new Error("Could not retrieve system secret for password encryption");
    }
    
    const secret = systemConfig.native.secret;
    let result = '';
    for (let i = 0; i < password.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
    }
    
    return result;
}

// Run integration tests with demo credentials
tests.integration(path.join(__dirname, ".."), {
    defineAdditionalTests({ suite }) {
        suite("API Testing with Demo Credentials", (getHarness) => {
            let harness;
            
            before(() => {
                harness = getHarness();
            });

            it("Should connect to API and initialize with demo credentials", async () => {
                console.log("Setting up demo credentials...");
                
                if (harness.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
                
                const encryptedPassword = await encryptPassword(harness, "demo_password");
                
                await harness.changeAdapterConfig("your-adapter", {
                    native: {
                        username: "demo@provider.com",
                        password: encryptedPassword,
                        // other config options
                    }
                });

                console.log("Starting adapter with demo credentials...");
                await harness.startAdapter();
                
                // Wait for API calls and initialization
                await new Promise(resolve => setTimeout(resolve, 60000));
                
                const connectionState = await harness.states.getStateAsync("your-adapter.0.info.connection");
                
                if (connectionState && connectionState.val === true) {
                    console.log("✅ SUCCESS: API connection established");
                    return true;
                } else {
                    throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
                        "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
                }
            }).timeout(120000);
        });
    }
});
```

## Error Handling

### WebSocket Error Scenarios
Handle these common WebSocket error scenarios:
- Connection refused (device offline)
- Network timeouts
- Invalid JSON responses
- Device firmware incompatibilities
- IP address changes

### Best Practices for Error Handling
```javascript
// Robust error handling for McLighting communication
function send(command) {
    if (!mclighting || mclighting.readyState !== WebSocket.OPEN) {
        adapter.log.warn('Cannot send command: WebSocket not connected');
        return;
    }
    
    try {
        const message = JSON.stringify({ command: command });
        mclighting.send(message);
        adapter.log.debug(`Sent command: ${command}`);
    } catch (error) {
        adapter.log.error(`Failed to send command: ${error.message}`);
        // Trigger reconnection if needed
        scheduleReconnection();
    }
}

function scheduleReconnection() {
    if (timeOutReconnect) {
        clearTimeout(timeOutReconnect);
    }
    
    timeOutReconnect = setTimeout(() => {
        adapter.log.info('Attempting to reconnect...');
        createConnection();
    }, 5000);
}
```

## Development Workflow

### Local Development Setup
1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run lint` to check code style
4. Run `npm test` to verify all tests pass
5. Use `npm run test:integration` for integration testing

### Making Changes
1. Create feature branches from master
2. Write tests for new functionality
3. Ensure all existing tests still pass
4. Update documentation as needed
5. Submit pull requests for review

### McLighting Protocol Documentation
The adapter communicates with McLighting devices using these command formats:
- `%255` - Set brightness (0-255)
- `#ff0000` - Set color (hex format)
- `=0` - Set to static color mode
- `/5` - Set animation mode (number)
- `?` - Request status update
- `*` - Prefix for static color commands
- `#` - Prefix for animation mode commands

### Testing with Real Hardware
When testing with actual ESP8266 devices:
1. Ensure the device is on the same network
2. Configure the correct IP address and port (default 81)
3. Verify McLighting firmware is compatible
4. Monitor WebSocket traffic for debugging
5. Test various color formats and animation modes