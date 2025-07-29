const { contextBridge, ipcRenderer } = require('electron');

// Expose secure API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Secure credential storage
    storeCredential: (service, account, password) => 
        ipcRenderer.invoke('store-credential', service, account, password),
    
    getCredential: (service, account) => 
        ipcRenderer.invoke('get-credential', service, account),
    
    deleteCredential: (service, account) => 
        ipcRenderer.invoke('delete-credential', service, account),
    
    // System checks
    checkSystem: () => 
        ipcRenderer.invoke('check-system'),
    
    // API validation
    validateAirtable: (token, baseId) => 
        ipcRenderer.invoke('validate-airtable', token, baseId),
    
    validateOpenAI: (apiKey) => 
        ipcRenderer.invoke('validate-openai', apiKey),
    
    // File operations
    selectDirectory: () => 
        ipcRenderer.invoke('select-directory'),
    
    createEnvFile: (config) => 
        ipcRenderer.invoke('create-env-file', config),
    
    // Deployment
    deployGame: (config) => 
        ipcRenderer.invoke('deploy-game', config),
    
    loginToVercel: () => 
        ipcRenderer.invoke('login-to-vercel'),
    
    // Logging
    log: (message, level) => 
        ipcRenderer.invoke('log', message, level),
    
    // External URLs
    openExternal: (url) => 
        ipcRenderer.invoke('open-external', url),
    
    // Event listeners
    onLogMessage: (callback) => 
        ipcRenderer.on('log-message', callback)
});