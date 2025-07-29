const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const keytar = require('keytar');
const { spawn, exec } = require('child_process');
const fetch = require('node-fetch');

// Security: Enable context isolation and disable node integration
const isDev = process.env.NODE_ENV === 'development';

class SecureLauncher {
    constructor() {
        this.mainWindow = null;
        this.gameDirectory = null;
        this.setupIPC();
    }

    createWindow() {
        this.mainWindow = new BrowserWindow({
            width: 1000,
            height: 700,
            minWidth: 800,
            minHeight: 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, 'preload.js')
            },
            icon: path.join(__dirname, 'assets', 'icon.png'),
            show: false,
            titleBarStyle: 'default'
        });

        this.mainWindow.loadFile('launcher.html');

        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
            this.log('Secure launcher window ready');
        });

        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        // Security: Prevent new window creation and external navigation
        this.mainWindow.webContents.setWindowOpenHandler(() => {
            return { action: 'deny' };
        });

        this.mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
            const parsedUrl = new URL(navigationUrl);
            
            if (parsedUrl.origin !== 'file://') {
                event.preventDefault();
                shell.openExternal(navigationUrl);
            }
        });
    }

    setupIPC() {
        // Secure credential storage
        ipcMain.handle('store-credential', async (event, service, account, password) => {
            try {
                await keytar.setPassword(service, account, password);
                this.log(`Credential stored securely: ${service}/${account}`);
                return { success: true };
            } catch (error) {
                this.log(`Failed to store credential: ${error.message}`, 'error');
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('get-credential', async (event, service, account) => {
            try {
                const password = await keytar.getPassword(service, account);
                return { success: true, password };
            } catch (error) {
                this.log(`Failed to retrieve credential: ${error.message}`, 'error');
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('delete-credential', async (event, service, account) => {
            try {
                const deleted = await keytar.deletePassword(service, account);
                this.log(`Credential deleted: ${service}/${account}`);
                return { success: true, deleted };
            } catch (error) {
                this.log(`Failed to delete credential: ${error.message}`, 'error');
                return { success: false, error: error.message };
            }
        });

        // System checks
        ipcMain.handle('check-system', async () => {
            return await this.checkSystemRequirements();
        });

        // API validation
        ipcMain.handle('validate-airtable', async (event, token, baseId) => {
            return await this.validateAirtableConnection(token, baseId);
        });

        ipcMain.handle('validate-openai', async (event, apiKey) => {
            return await this.validateOpenAIConnection(apiKey);
        });

        // File operations
        ipcMain.handle('select-directory', async () => {
            const result = await dialog.showOpenDialog(this.mainWindow, {
                properties: ['openDirectory'],
                title: 'Select Game Directory'
            });

            if (!result.canceled && result.filePaths.length > 0) {
                this.gameDirectory = result.filePaths[0];
                return { success: true, directory: this.gameDirectory };
            }

            return { success: false };
        });

        ipcMain.handle('create-env-file', async (event, config) => {
            return await this.createEnvironmentFile(config);
        });

        // Deployment
        ipcMain.handle('deploy-game', async (event, config) => {
            return await this.deployGame(config);
        });

        // Vercel login
        ipcMain.handle('login-to-vercel', async () => {
            return await this.loginToVercel();
        });

        // Logging
        ipcMain.handle('log', (event, message, level = 'info') => {
            // Only log to console, don't send back to renderer to prevent loops
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
        });

        // Open external URLs safely
        ipcMain.handle('open-external', (event, url) => {
            shell.openExternal(url);
        });
    }

    async checkSystemRequirements() {
        const results = {
            node: false,
            npm: false,
            git: false,
            vercel: false
        };

        try {
            // Check Node.js
            const nodeVersion = await this.executeCommand('node --version');
            results.node = {
                installed: true,
                version: nodeVersion.trim()
            };
        } catch (error) {
            results.node = { installed: false, error: error.message };
        }

        try {
            // Check npm
            const npmVersion = await this.executeCommand('npm --version');
            results.npm = {
                installed: true,
                version: npmVersion.trim()
            };
        } catch (error) {
            results.npm = { installed: false, error: error.message };
        }

        try {
            // Check Git
            const gitVersion = await this.executeCommand('git --version');
            results.git = {
                installed: true,
                version: gitVersion.trim()
            };
        } catch (error) {
            results.git = { installed: false, error: error.message };
        }

        try {
            // Check Vercel CLI
            const vercelVersion = await this.executeCommand('vercel --version');
            results.vercel = {
                installed: true,
                version: vercelVersion.trim()
            };
        } catch (error) {
            results.vercel = { installed: false, error: error.message };
        }

        return results;
    }

    async validateAirtableConnection(token, baseId) {
        try {
            // First, try to get base schema to validate access
            const schemaResponse = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (schemaResponse.ok) {
                const schemaData = await schemaResponse.json();
                this.log('Airtable connection validated successfully');
                return { 
                    success: true, 
                    message: 'Connection successful',
                    canRead: true,
                    canWrite: true,
                    tables: schemaData.tables?.length || 0
                };
            } else if (schemaResponse.status === 404) {
                // If schema endpoint fails, try a simple base access check
                const baseResponse = await fetch(`https://api.airtable.com/v0/${baseId}?maxRecords=1`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (baseResponse.ok) {
                    this.log('Airtable base access validated');
                    return { 
                        success: true, 
                        message: 'Base access confirmed',
                        canRead: true,
                        canWrite: true
                    };
                } else {
                    const errorData = await baseResponse.json();
                    return { 
                        success: false, 
                        error: errorData.error?.message || 'Invalid base ID or insufficient permissions',
                        status: baseResponse.status
                    };
                }
            } else {
                const errorData = await schemaResponse.json();
                return { 
                    success: false, 
                    error: errorData.error?.message || 'Connection failed',
                    status: schemaResponse.status
                };
            }
        } catch (error) {
            this.log(`Airtable validation failed: ${error.message}`, 'error');
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    async validateOpenAIConnection(apiKey) {
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.log('OpenAI connection validated successfully');
                return { 
                    success: true, 
                    message: 'API key valid',
                    models: data.data?.length || 0
                };
            } else {
                const errorData = await response.json();
                return { 
                    success: false, 
                    error: errorData.error?.message || 'Invalid API key',
                    status: response.status
                };
            }
        } catch (error) {
            this.log(`OpenAI validation failed: ${error.message}`, 'error');
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    async createEnvironmentFile(config) {
        try {
            if (!this.gameDirectory) {
                throw new Error('No game directory selected');
            }

            // Copy game files from bundled resources if they don't exist
            let resourcesPath = path.join(process.resourcesPath, 'game');
            
            // In development, use the relative game directory
            if (!await fs.pathExists(resourcesPath)) {
                resourcesPath = path.join(__dirname, '..', 'game');
                this.log(`Using development game path: ${resourcesPath}`);
            } else {
                this.log(`Using packaged game path: ${resourcesPath}`);
            }
            
            // Check if package.json already exists in target directory
            const targetPackageJson = path.join(this.gameDirectory, 'package.json');
            if (await fs.pathExists(targetPackageJson)) {
                this.log('Game files already exist in target directory');
            } else if (await fs.pathExists(resourcesPath)) {
                this.log(`Copying game files from ${resourcesPath} to ${this.gameDirectory}`);
                
                // Ensure target directory exists
                await fs.ensureDir(this.gameDirectory);
                
                // Copy with overwrite enabled to ensure files are properly copied
                await fs.copy(resourcesPath, this.gameDirectory, {
                    overwrite: true,
                    errorOnExist: false
                });
                
                // Verify the copy worked
                if (await fs.pathExists(targetPackageJson)) {
                    this.log('Game files copied successfully');
                } else {
                    throw new Error('Game files copy failed - package.json not found after copy');
                }
            } else {
                throw new Error(`Game files not found at ${resourcesPath}`);
            }

            const envContent = `# Depths of Ascension - Environment Variables
# Generated by secure launcher on ${new Date().toISOString()}

AIRTABLE_PAT=${config.airtablePAT}
AIRTABLE_BASE_ID=${config.airtableBaseId}
OPENAI_API_KEY=${config.openaiApiKey}
ADMIN_PASSWORD=${config.adminPassword}

# Optional Configuration
DEBUG_MODE=false
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=3600
`;

            const envPath = path.join(this.gameDirectory, '.env.local');
            await fs.writeFile(envPath, envContent);

            // Set restrictive permissions (Unix-like systems)
            if (process.platform !== 'win32') {
                await fs.chmod(envPath, 0o600);
            }

            this.log(`Environment file created: ${envPath}`);
            return { success: true, path: envPath };
        } catch (error) {
            this.log(`Failed to create environment file: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    async deployGame(config) {
        try {
            if (!this.gameDirectory) {
                throw new Error('No game directory selected');
            }

            // First, ensure game files are copied and environment file is created
            this.log('Setting up game files...');
            const envResult = await this.createEnvironmentFile(config);
            if (!envResult.success) {
                throw new Error(envResult.error);
            }

            // Change to game directory
            process.chdir(this.gameDirectory);

            // Install dependencies if needed
            if (!await fs.pathExists(path.join(this.gameDirectory, 'node_modules'))) {
                this.log('Installing dependencies...');
                await this.executeCommand('npm install');
            }

            // Check if user is logged into Vercel
            this.log('Checking Vercel authentication...');
            try {
                await this.executeCommand('vercel whoami');
                this.log('Vercel authentication confirmed');
            } catch (error) {
                this.log('Vercel login required');
                throw new Error('Please login to Vercel first. Run "vercel login" in the deployed game directory or use the Vercel CLI to authenticate.');
            }

            // Deploy to Vercel
            this.log('Deploying to Vercel...');
            const deployOutput = await this.executeCommand('vercel --prod --yes');

            // Extract deployment URL
            const urlMatch = deployOutput.match(/https:\/\/[^\s]+/);
            const deploymentUrl = urlMatch ? urlMatch[0] : null;

            this.log(`Deployment successful: ${deploymentUrl}`);
            return { 
                success: true, 
                url: deploymentUrl,
                output: deployOutput
            };
        } catch (error) {
            this.log(`Deployment failed: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    async loginToVercel() {
        try {
            if (!this.gameDirectory) {
                throw new Error('No game directory selected');
            }

            // Change to game directory for Vercel login
            const originalDir = process.cwd();
            process.chdir(this.gameDirectory);

            this.log('Starting Vercel login process...');
            await this.executeCommand('vercel login');

            // Verify login worked
            await this.executeCommand('vercel whoami');
            
            // Restore original directory
            process.chdir(originalDir);
            
            this.log('Vercel login completed successfully');
            return { success: true };
        } catch (error) {
            this.log(`Vercel login failed: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    async executeCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
        
        // Only send specific system messages to renderer, not user-initiated logs
        if (this.mainWindow && this.mainWindow.webContents && 
            (message.includes('validation') || message.includes('connection') || message.includes('failed'))) {
            this.mainWindow.webContents.send('log-message', {
                timestamp,
                level,
                message
            });
        }
    }
}

// App event handlers
const launcher = new SecureLauncher();

app.whenReady().then(() => {
    launcher.createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            launcher.createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.on('will-attach-webview', (event, webPreferences, params) => {
        event.preventDefault();
    });

    contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        
        if (parsedUrl.origin !== 'file://') {
            event.preventDefault();
        }
    });
});

// Handle certificate errors in development
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    if (isDev) {
        event.preventDefault();
        callback(true);
    } else {
        callback(false);
    }
});