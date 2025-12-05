import { ChangeDetectionStrategy, Component, computed, signal, effect, OnDestroy } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, Auth, User, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, Firestore, Unsubscribe, query, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';

// --- Global environment variables (Used by Angular build process) ---
declare const __app_id: string;
declare const __firebase_config: string;
declare const __initial_auth_token: string;

// --- INTERFACES ---

interface CustomProperty { 
    key: string;
    value: string;
}

interface Account {
  name: string;
  username: string;
  service: string;
  protocol: 'SSH' | 'RDP' | 'HTTPS' | 'Database' | 'Other';
}

interface Software {
  name: string;
  version: string;
  purpose: string;
}

interface Service {
  name: string;
  portUrl: string; 
  notes: string;
}

interface PerformanceLog {
    timestamp: string;
    notes: string;
}

type SystemStatus = 'Active' | 'Maintenance' | 'Decommissioned' | 'Archived'; 

interface System {
  id: string; 
  name: string;
  role: string;
  model: string; 
  specs: string; 
  os: string[]; 
  ipAddress: string; 
  macAddress: string; 
  location: string; 
  status: SystemStatus;
  performanceNotes: string; 
  accounts: Account[];
  software: Software[];
  services: Service[]; 
  performanceHistory: PerformanceLog[];
  customProperties: CustomProperty[];
  tags: string[]; 
}

@Component({
  selector: 'app-root',
  template: `
    <div class="min-h-screen bg-slate-900 text-gray-200 p-4 sm:p-8 font-inter">
      <header class="mb-10 text-center">
        <div class="flex items-center justify-center">
            <!-- ForgeTrack Hammer Icon (Inline SVG) -->
            <svg class="w-8 h-8 mr-3 text-blue-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M10.293 2.586a1 1 0 011.414 0l6.707 6.707a1 1 0 010 1.414l-6.707 6.707a1 1 0 01-1.414-1.414L15.586 11H3a1 1 0 110-2h12.586l-5.293-5.293a1 1 0 010-1.414z" fill="currentColor"/>
                <circle cx="5" cy="5" r="2" fill="#38bdf8"/>
                <circle cx="19" cy="19" r="2" fill="#10b981"/>
            </svg>
            <h1 class="text-4xl sm:text-5xl font-extrabold text-blue-400">ForgeTrack - HomeLab Inventory</h1>
        </div>
        <p class="text-gray-400 mt-2">Track and manage your main systems and accounts.</p>
        <div class="mt-4 text-xs text-gray-500">
          User ID: <span class="font-mono text-blue-500">{{ userId() || 'Authenticating...' }}</span>
        </div>
      </header>

      @if (!isAuthReady()) {
        <div class="text-center p-8 bg-slate-800 shadow-xl rounded-xl max-w-lg mx-auto">
          <svg class="animate-spin h-6 w-6 mr-3 text-blue-500 inline-block" viewBox="0 0 24 24">...</svg>
          <span class="text-lg font-medium text-gray-300">Loading Configuration...</span>
        </div>
      } @else {
        <!-- Authentication Guard Modal (NEW) -->
        @if (isAnonymousUser()) {
          <div class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div class="bg-slate-800 p-8 rounded-xl shadow-2xl max-w-md w-full border border-yellow-500/50">
              <h3 class="text-2xl font-bold text-yellow-400 mb-4">Account Upgrade Required</h3>
              <p class="text-gray-300 mb-6">
                For security and data integrity, you must sign in with a permanent account to begin using ForgeTrack. Your inventory data will be securely tied to this account.
              </p>
              <button (click)="signInWithGoogle()" class="w-full py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-500 transition shadow-md flex items-center justify-center">
                <svg class="w-5 h-5 mr-2" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M44.5 20H24v8h11.3c-.7 3.3-3.2 6.1-6.8 7.4v5h3.8c4.5-1.5 7.9-5.7 8.9-10.8z" fill="#4285F4"/><path d="M24 44c6.3 0 11.6-2.1 15.5-5.7l-3.8-5c-2.3 1.6-5.2 2.6-8.7 2.6-6.7 0-12.4-4.5-14.4-10.7h-4.2v5C8 40.5 15.4 44 24 44z" fill="#34A853"/><path d="M9.6 29.3c-.4-1.3-.6-2.6-.6-4.3s.2-3 .6-4.3V16h-4.2c-.8 2.2-1.4 4.5-1.4 7s.5 4.8 1.4 7l4.2-3.7z" fill="#FBBC04"/><path d="M24 13.5c3.2 0 5.8 1.1 7.9 3.1L35 12.6c-3.9-3.6-9.2-5.7-15.5-5.7-8.6 0-16 3.5-21.2 10.3l4.2 3.7c2-6.2 7.7-10.7 14.4-10.7z" fill="#EA4335"/></svg>
                Sign In with Google
              </button>
            </div>
          </div>
        }
        
        <!-- Main Dashboard Content (Hidden if Anonymous) -->
        <div [class]="isAnonymousUser() ? 'hidden' : ''">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-6">
              @for (system of activeSystems(); track system.id) {
                <div
                  (click)="selectSystem(system.id)"
                  [class]="systemCardClass(system.id, system.status)"
                >
                  <div class="flex justify-between items-start mb-2">
                    <h2 class="text-xl font-bold text-gray-100">{{ system.name }}</h2>
                    <span [class]="statusBadgeClass(system.status)">
                      {{ system.status }}
                    </span>
                  </div>
                  
                  <p class="text-sm text-gray-400 mb-2">{{ system.role }}</p>
                  <div class="space-y-1 mt-3 text-gray-300">
                    <p class="flex items-center text-sm"><span class="font-semibold w-20 text-blue-300">Model:</span> {{ system.model }}</p>
                    <p class="flex items-center text-sm"><span class="font-semibold w-20 text-blue-300">OS:</span> {{ system.os.length }} installed</p>
                    <p class="flex items-center text-sm"><span class="font-semibold w-20 text-blue-300">IP:</span> {{ system.ipAddress }}</p>
                    <p class="flex items-center text-sm"><span class="font-semibold w-20 text-blue-300">Services:</span> {{ system.services.length }} running</p>
                  </div>
                </div>
              }
            </div>
            
            <!-- Action Buttons & Parser Section -->
            <div class="max-w-6xl mx-auto mb-6 space-y-6">
                <!-- New System Button -->
                <div class="flex justify-center">
                    <button 
                        (click)="addNewSystem()" 
                        class="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition shadow-lg border border-blue-700/50"
                    >
                        <svg class="w-5 h-5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        Add New Device
                    </button>
                </div>
                
                <!-- System Info Parser -->
                <div class="p-4 bg-slate-800 border border-blue-600/50 rounded-xl shadow-xl">
                    <h3 class="text-xl font-bold text-blue-400 mb-3">System Info Parser (BETA)</h3>
                    <p class="text-sm text-gray-400 mb-4">
                        Paste system information output (like Windows "About" or Linux <code>lshw</code>) below. 
                        Select the target system and click Parse to auto-fill the relevant fields.
                    </p>
                    
                    <div class="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                        <textarea 
                            #parserInput
                            rows="4" 
                            placeholder="Paste system info here..." 
                            class="flex-grow w-full rounded-md border-gray-600 shadow-sm p-2 bg-slate-900 text-gray-200 resize-none focus:ring-blue-500 focus:border-blue-500"
                        ></textarea>

                        <div class="flex-shrink-0 flex flex-col space-y-2">
                            <select #targetSystemSelect class="w-full sm:w-40 rounded-md border-gray-600 shadow-sm p-2 bg-slate-800 text-gray-200 focus:ring-blue-500 focus:border-blue-500">
                                @for (system of systems(); track system.id) {
                                    <option [value]="system.id">{{ system.name }}</option>
                                }
                            </select>
                            <button 
                                (click)="parsePastedData(parserInput.value, targetSystemSelect.value)" 
                                class="w-full sm:w-40 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition shadow-md border border-green-700/50"
                            >
                                <svg class="w-5 h-5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                Parse & Update
                            </button>
                            @if (parserMessage()) {
                                <p class="text-xs text-green-400 mt-1">{{ parserMessage() }}</p>
                            }
                        </div>
                    </div>
                </div>
            </div>

            
            <!-- Data Export Section -->
            <div class="p-4 bg-slate-800 border border-gray-600 rounded-xl shadow-xl flex justify-center space-x-4">
                <button 
                    (click)="exportData('json')" 
                    class="px-4 py-2 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-600 transition shadow-md"
                >
                    <svg class="w-5 h-5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    Export JSON
                </button>
                <button 
                    (click)="exportData('csv')" 
                    class="px-4 py-2 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-600 transition shadow-md"
                >
                    <svg class="w-5 h-5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    Export CSV
                </button>
            </div>
        </div>


        <!-- Deep Access Promotion Banner (Conditional Rendering) -->
        @if (!isProUser()) {
            <div class="max-w-6xl mx-auto p-6 bg-yellow-900/40 border border-yellow-600 rounded-xl shadow-inner text-center mb-10">
                <h3 class="text-xl font-bold text-yellow-300 flex items-center justify-center mb-2">
                    <svg class="w-6 h-6 mr-2 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-2.485 0-4.5 2.015-4.5 4.5s2.015 4.5 4.5 4.5 4.5-2.015 4.5-4.5S14.485 8 12 8zM12 18s-4.5-3.375-4.5-4.5S9.515 8 12 8s4.5 2.015 4.5 4.5S12 18zM12 21a9 9 0 100-18 9 9 0 000 18z"></path></svg>
                    Deep Access: Secure File Transfer & Diagnostics (PRO)
                </h3>
                <p class="text-gray-300 text-sm">
                    Unlock advanced features like the RPi Proxy integration for **direct file browsing** and **remote diagnostics**.
                </p>
                <p class="text-gray-300 text-sm mt-1 mb-3 font-semibold">
                    Access is granted via a one-time $10 donation to support server costs.
                </p>
                <button (click)="isProUser.set(true)" class="inline-block px-6 py-2 bg-yellow-600 text-gray-900 font-bold rounded-full hover:bg-yellow-500 transition shadow-lg shadow-yellow-900/50">
                    Simulate PRO Access (Click to dismiss)
                </button>
            </div>
        } @else {
            <div class="max-w-6xl mx-auto p-6 bg-green-900/40 border border-green-600 rounded-xl shadow-inner text-center mb-10">
                <p class="text-lg font-bold text-green-300">PRO Access Unlocked!</p>
                <p class="text-sm text-gray-300 mt-1">
                    You now have access to Deep Access features (File Transfer, Diagnostics).
                </p>
            </div>
        }


        <!-- Detail/Editor Panel -->
        <div [class]="detailPanelClass()" class="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-slate-700 shadow-2xl shadow-black/80 transition-transform duration-300 ease-in-out p-6 overflow-y-auto border-l border-blue-600/50">
          @if (selectedSystem()) {
            <div class="flex justify-between items-center mb-6 border-b border-gray-600 pb-4">
              <h2 class="text-2xl font-bold text-blue-400">{{ selectedSystem()!.name }} Details</h2>
              <button (click)="unselectSystem()" class="text-gray-400 hover:text-white p-2 rounded-full hover:bg-slate-600 transition">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <!-- Remote Access Commands -->
            <h3 class="text-xl font-semibold mt-6 mb-3 text-gray-200">Remote Access Launchpad</h3>
            <div class="space-y-3 p-4 bg-slate-800 rounded-lg border border-blue-600/50">
                @if (sshCommand()) {
                    <div class="bg-slate-900 p-3 rounded-lg shadow-md border border-blue-500/30">
                        <p class="text-sm font-medium text-blue-400 mb-1">SSH/Terminal Command:</p>
                        <div class="flex items-center">
                            <code class="flex-grow text-xs bg-gray-800 text-green-400 p-2 rounded font-mono break-all">{{ sshCommand() }}</code>
                            <button (click)="copyToClipboard(sshCommand()!)" class="ml-2 p-1.5 text-blue-400 hover:bg-slate-600 rounded transition" title="Copy SSH Command">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v1M7 13h4m-4 4h4m6-4h.01M17 17h.01"></path></svg>
                            </button>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">Uses the IP and the first documented SSH account's username.</p>
                    </div>
                }
                
                @if (rdpLink()) {
                    <div class="bg-slate-900 p-3 rounded-lg shadow-md border border-blue-500/30">
                        <p class="text-sm font-medium text-blue-400 mb-1">RDP Link (Windows Desktop):</p>
                        <div class="flex items-center">
                            <code class="flex-grow text-xs bg-gray-800 text-green-400 p-2 rounded font-mono break-all">{{ rdpLink() }}</code>
                            <button (click)="copyToClipboard(rdpLink()!)" class="ml-2 p-1.5 text-blue-400 hover:bg-slate-600 rounded transition" title="Copy RDP Link">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v1M7 13h4m-4 4h4m6-4h.01M17 17h.01"></path></svg>
                            </button>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">Open this link in your browser to launch RDP clients on some operating systems.</p>
                    </div>
                }

                @if (!sshCommand() && !rdpLink()) {
                    <p class="text-sm text-gray-400">No specific SSH or RDP connection details found. Ensure the IP address is set and a relevant account/service (SSH or Windows Login) is documented.</p>
                }
                
            </div>
            
            <!-- System Info Editor -->
            <h3 class="text-xl font-semibold mt-6 mb-3 text-gray-200">System Information</h3>
            <div class="space-y-4">
              <label class="block">
                <span class="text-sm font-medium text-gray-400">Status</span>
                <select [value]="selectedSystem()!.status" (change)="updateSystemField('status', $event)" class="mt-1 block w-full rounded-md border-gray-600 shadow-sm p-2 bg-slate-800 text-gray-200 focus:ring-blue-500 focus:border-blue-500">
                    <option value="Active">Active</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Decommissioned">Decommissioned</option>
                    <option value="Archived">Archived</option>
                </select>
              </label>
              <label class="block">
                <span class="text-sm font-medium text-gray-400">System Name</span>
                <input type="text" [value]="selectedSystem()!.name" (input)="updateSystemField('name', $event)" class="mt-1 block w-full rounded-md border-gray-600 shadow-sm p-2 bg-slate-800 text-gray-200 focus:ring-blue-500 focus:border-blue-500">
              </label>
              <label class="block">
                <span class="text-sm font-medium text-gray-400">Role/Purpose</span>
                <input type="text" [value]="selectedSystem()!.role" (input)="updateSystemField('role', $event)" class="mt-1 block w-full rounded-md border-gray-600 shadow-sm p-2 bg-slate-800 text-gray-200 focus:ring-blue-500 focus:border-blue-500">
              </label>
              
              <label class="block mt-4">
                <span class="text-sm font-medium text-gray-400">Device Model/Name</span>
                <input type="text" [value]="selectedSystem()!.model" (input)="updateSystemField('model', $event)" placeholder="e.g., Dell Latitude 7420, Raspberry Pi 4" class="mt-1 block w-full rounded-md border-gray-600 shadow-sm p-2 bg-slate-800 text-gray-200 focus:ring-blue-500 focus:border-blue-500">
              </label>

              <!-- Component Specs -->
              <label class="block">
                <span class="text-sm font-medium text-gray-400">Component Specs (CPU, RAM, Storage)</span>
                <input type="text" [value]="selectedSystem()!.specs" (input)="updateSystemField('specs', $event)" placeholder="e.g., i7-1185G7, 32GB DDR4, 1TB NVMe" class="mt-1 block w-full rounded-md border-gray-600 shadow-sm p-2 bg-slate-800 text-gray-200 focus:ring-blue-500 focus:border-blue-500">
              </label>
              
              <!-- Multi-OS List Editor -->
              <h4 class="text-base font-semibold mt-4 mb-2 text-gray-300">Operating Systems ({{ selectedSystem()!.os.length }})</h4>
              <div class="space-y-2 p-3 bg-slate-900 rounded-lg border border-gray-700">
                @for (osName of selectedSystem()!.os; track $index) {
                    <div class="flex space-x-2 items-center bg-slate-800 p-2 rounded shadow-inner">
                        <input 
                            type="text" 
                            [value]="osName" 
                            (input)="updateOsItem($index, $event)"
                            placeholder="OS Name (e.g., Windows 11, Ubuntu)"
                            class="flex-grow text-sm border-b border-gray-600 pb-1 focus:outline-none focus:border-blue-400 bg-slate-800 text-gray-200"
                        >
                        <button (click)="removeOsItem($index)" class="text-red-400 hover:text-red-300 p-1 rounded-full hover:bg-slate-700">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
                        </button>
                    </div>
                }
                <button (click)="addOsItem()" class="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition text-sm font-bold border border-blue-700/50 mt-1">
                    + Add Operating System
                </button>
              </div>
            </div>

            <!-- Tags/Groupings -->
            <h3 class="text-xl font-semibold mt-8 mb-3 text-gray-200">Tags & Grouping</h3>
            <div class="space-y-2 p-3 bg-slate-800 rounded-lg border border-gray-600">
                <input 
                    type="text" 
                    placeholder="Enter tags separated by commas (e.g., Docker, Gaming, Virtual)"
                    [value]="selectedSystem()!.tags.join(', ')"
                    (input)="updateTags($event)"
                    class="block w-full rounded-md border-gray-600 shadow-sm p-2 bg-slate-900 text-gray-200 focus:ring-blue-500 focus:border-blue-500"
                >
                <div class="flex flex-wrap gap-2 mt-2">
                    @for (tag of selectedSystem()!.tags; track tag) {
                        <span class="px-2 py-0.5 text-xs bg-blue-900 text-blue-300 rounded-full border border-blue-700">
                            {{ tag }}
                        </span>
                    }
                </div>
            </div>

            <!-- Network/Location Editor -->
            <h3 class="text-xl font-semibold mt-8 mb-3 text-gray-200">Network & Physical Location</h3>
            <div class="space-y-4">
                <label class="block">
                    <span class="text-sm font-medium text-gray-400">IP Address (Static preferred)</span>
                    <input 
                        type="text" 
                        [value]="selectedSystem()!.ipAddress" 
                        (input)="updateAndValidateIp($event)" 
                        placeholder="e.g., 192.168.1.10" 
                        [class]="ipAddressInputClass(selectedSystem()!.ipAddress, true)"
                    >
                    @if (ipError()) {
                        <p class="text-xs text-red-400 mt-1">⚠️ {{ ipError() }}</p>
                    }
                </label>
                <label class="block">
                    <span class="text-sm font-medium text-gray-400">MAC Address</span>
                    <input 
                        type="text" 
                        [value]="selectedSystem()!.macAddress" 
                        (input)="updateAndValidateMac($event)" 
                        placeholder="e.g., A1:B2:C3:D4:E5:F6" 
                        [class]="macAddressInputClass(selectedSystem()!.macAddress, true)"
                    >
                    @if (macError()) {
                        <p class="text-xs text-red-400 mt-1">⚠️ {{ macError() }}</p>
                    }
                </label>
                <label class="block">
                    <span class="text-sm font-medium text-gray-400">Location</span>
                    <input type="text" [value]="selectedSystem()!.location" (input)="updateSystemField('location', $event)" placeholder="e.g., Office Desk, Server Rack" class="mt-1 block w-full rounded-md border-gray-600 shadow-sm p-2 bg-slate-800 text-gray-200 focus:ring-blue-500 focus:border-blue-500">
                </label>
            </div>

            <!-- Custom Properties -->
            <h3 class="text-xl font-semibold mt-8 mb-3 text-gray-200">Custom Properties</h3>
            <div class="space-y-3 p-4 bg-slate-800 rounded-lg border border-gray-600">
                @for (prop of selectedSystem()!.customProperties; track $index) {
                    <div class="flex space-x-2 items-center bg-slate-900 p-3 rounded-lg shadow-inner border border-gray-700">
                        <input 
                            type="text" 
                            [value]="prop.key" 
                            (input)="updateCustomProp($index, 'key', $event)" 
                            placeholder="Key (e.g., GPU Driver Ver.)"
                            class="w-1/3 text-sm border-b border-gray-600 pb-1 focus:outline-none focus:border-blue-400 bg-slate-900 text-gray-200"
                        >
                        <input 
                            type="text" 
                            [value]="prop.value" 
                            (input)="updateCustomProp($index, 'value', $event)" 
                            placeholder="Value"
                            class="flex-grow text-sm border-b border-gray-600 pb-1 focus:outline-none focus:border-blue-400 bg-slate-900 text-gray-200"
                        >
                        <button (click)="removeCustomProp($index)" class="text-red-400 hover:text-red-300 p-1 rounded-full hover:bg-slate-600">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
                        </button>
                    </div>
                }
                <button (click)="addCustomProp()" class="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition text-sm font-bold border border-blue-700/50 mt-1">
                    + Add Custom Property
                </button>
            </div>

            <!-- Performance Notes Editor -->
            <h3 class="text-xl font-semibold mt-8 mb-3 text-gray-200">Performance Targets & Notes (Manual Log)</h3>
            <label class="block">
                <span class="text-sm font-medium text-gray-400">Baseline Performance Notes (Enter current stats here)</span>
                <textarea 
                    #currentPerformanceNotes
                    [value]="selectedSystem()!.performanceNotes" 
                    (input)="updateSystemField('performanceNotes', $event)" 
                    rows="4" 
                    placeholder="e.g., Target idle RAM usage: 4GB. Max CPU temp under load: 65°C." 
                    class="mt-1 block w-full rounded-md border-gray-600 shadow-sm p-2 bg-slate-800 text-gray-200 focus:ring-blue-500 focus:border-blue-500 resize-none"
                ></textarea>
            </label>
            <button 
                (click)="captureAndClearNotes(currentPerformanceNotes)" 
                class="w-full py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition shadow-md border border-blue-700/50 mt-2"
            >
                <svg class="w-5 h-5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                Snapshot Current Performance to History
            </button>


            <!-- Performance History Log -->
            <h3 class="text-xl font-semibold mt-8 mb-3 text-gray-200">Performance History</h3>
            <div class="space-y-3 p-4 bg-slate-800 rounded-lg border border-gray-600">
                @if (selectedSystem()!.performanceHistory.length > 0) {
                    @for (log of selectedSystem()!.performanceHistory; track $index) {
                        <div class="bg-slate-900 p-3 rounded-lg shadow-inner border border-gray-700">
                            <p class="text-xs text-gray-400 mb-1">Logged: {{ formatDate(log.timestamp) }}</p>
                            <p class="text-sm text-gray-200 whitespace-pre-wrap">{{ log.notes }}</p>
                        </div>
                    }
                } @else {
                    <p class="text-sm text-gray-500">No performance history recorded yet. Use the Snapshot button above to start tracking!</p>
                }
            </div>


            <!-- Services List Editor -->
            <h3 class="text-xl font-semibold mt-8 mb-3 text-gray-200">Running Services / Containers</h3>
            <div class="space-y-3 p-4 bg-slate-800 rounded-lg border border-gray-600">
                @for (item of selectedSystem()!.services; track $index) {
                    <div class="flex space-x-2 items-center bg-slate-900 p-3 rounded-lg shadow-md border border-gray-700">
                        <div class="flex-grow">
                            <input type="text" [value]="item.name" (input)="updateListItem('services', $index, 'name', $event)" placeholder="Service Name" class="text-sm font-medium w-full border-b border-gray-600 pb-1 focus:outline-none focus:border-blue-400 bg-slate-900 text-gray-200">
                            
                            <!-- Display clickable link or input field based on content -->
                            @if (isUrl(item.portUrl)) {
                                <a [href]="normalizeUrl(item.portUrl)" target="_blank" class="text-xs w-full mt-1 text-green-400 hover:underline cursor-pointer flex items-center">
                                    {{ item.portUrl }} 
                                    <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                </a>
                                <input type="text" [value]="item.portUrl" (input)="updateListItem('services', $index, 'portUrl', $event)" placeholder="Port / URL" class="text-xs w-full mt-1 text-gray-400 focus:outline-none bg-slate-900 border-gray-800">
                            } @else {
                                <input type="text" [value]="item.portUrl" (input)="updateListItem('services', $index, 'portUrl', $event)" placeholder="Port / URL" class="text-xs w-full mt-1 text-gray-400 focus:outline-none bg-slate-900 border-gray-800">
                            }
                            
                            <input type="text" [value]="item.notes" (input)="updateListItem('services', $index, 'notes', $event)" placeholder="Notes (e.g., Docker, requires VPN)" class="text-xs w-full mt-1 text-gray-400 focus:outline-none bg-slate-900 border-gray-800">
                        </div>
                        <button (click)="removeItem('services', $index)" class="text-red-400 hover:text-red-300 p-1 rounded-full hover:bg-slate-600">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
                        </button>
                    </div>
                }
                <button (click)="addItem('services')" class="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition text-sm font-bold border border-blue-700/50">
                    + Add New Service/Container
                </button>
            </div>


            <!-- Software List Editor -->
            <h3 class="text-xl font-semibold mt-8 mb-3 text-gray-200">Software Installed</h3>
            <div class="space-y-3 p-4 bg-slate-800 rounded-lg border border-gray-600">
                <!-- Search/Filter Input -->
                <input 
                    type="text" 
                    placeholder="Filter software by name or purpose..."
                    [value]="softwareFilter()"
                    (input)="softwareFilter.set($event.target.value)"
                    class="block w-full rounded-md border-gray-600 shadow-sm p-2 bg-slate-900 text-gray-200 focus:ring-blue-500 focus:border-blue-500"
                >

              @for (item of filteredSoftware(); track getOriginalSoftwareIndex(item)) {
                    <div class="flex space-x-2 items-center bg-slate-900 p-3 rounded-lg shadow-md border border-gray-700">
                        <div class="flex-grow">
                            <!-- Find the original index for update/remove operations -->
                            @let originalIndex = getOriginalSoftwareIndex(item);
                            
                            <input type="text" [value]="item.name" (input)="updateListItem('software', originalIndex, 'name', $event)" placeholder="Name" class="text-sm font-medium w-full border-b border-gray-600 pb-1 focus:outline-none focus:border-blue-400 bg-slate-900 text-gray-200">
                            <input type="text" [value]="item.purpose" (input)="updateListItem('software', originalIndex, 'purpose', $event)" placeholder="Purpose" class="text-xs w-full mt-1 text-gray-400 focus:outline-none bg-slate-900 border-gray-800">
                            <input type="text" [value]="item.version" (input)="updateListItem('software', originalIndex, 'version', $event)" placeholder="Ver." class="text-xs w-full mt-1 text-gray-400 focus:outline-none bg-slate-900 border-gray-800">
                        </div>
                        <button (click)="removeItem('software', originalIndex)" class="text-red-400 hover:text-red-300 p-1 rounded-full hover:bg-slate-600">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
                        </button>
                    </div>
              }
              <button (click)="addItem('software')" class="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition text-sm font-bold border border-blue-700/50">
                + Add New Software
              </button>
            </div>

            <!-- Account List Editor -->
            <h3 class="text-xl font-semibold mt-8 mb-3 text-gray-200">Accounts & Credentials (Username/Service)</h3>
            <div class="space-y-3 p-4 bg-slate-800 rounded-lg border border-gray-600 mb-10">
              <p class="text-xs text-red-400 font-medium p-1 bg-red-900/40 rounded-md border border-red-700/50">⚠️ **Do NOT store passwords in this system.** Only usernames/service names.</p>
              @for (item of selectedSystem()!.accounts; track $index) {
                <div class="flex space-x-2 items-center bg-slate-900 p-3 rounded-lg shadow-md border border-gray-700">
                  <div class="flex-grow">
                    <input type="text" [value]="item.name" (input)="updateListItem('accounts', $index, 'name', $event)" placeholder="Name" class="text-sm font-medium w-full border-b border-gray-600 pb-1 focus:outline-none focus:border-blue-400 bg-slate-900 text-gray-200">
                    
                    <select [value]="item.protocol" (change)="updateListItem('accounts', $index, 'protocol', $event)" class="text-xs w-full mt-1 block rounded-md border-gray-600 shadow-sm p-1 bg-slate-800 text-gray-300 focus:ring-blue-500 focus:border-blue-500">
                        <option value="SSH">SSH</option>
                        <option value="RDP">RDP</option>
                        <option value="HTTPS">HTTPS (Web UI)</option>
                        <option value="Database">Database (SQL/Mongo)</option>
                        <option value="Other">Other</option>
                    </select>

                    <input type="text" [value]="item.username" (input)="updateListItem('accounts', $index, 'username', $event)" placeholder="Username/Email" class="text-xs w-full mt-1 text-gray-400 focus:outline-none bg-slate-900 border-gray-800">
                    <input type="text" [value]="item.service" (input)="updateListItem('accounts', $index, 'service', $event)" placeholder="Service Description (DockerHub, Windows Login)" class="text-xs w-full mt-1 text-gray-400 focus:outline-none bg-slate-900 border-gray-800">
                  </div>
                  <button (click)="removeItem('accounts', $index)" class="text-red-400 hover:text-red-300 p-1 rounded-full hover:bg-slate-600">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
                  </button>
                </div>
              }
              <button (click)="addItem('accounts')" class="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition text-sm font-bold border border-blue-700/50">
                + Add New Account
              </button>
            </div>
          }
        </div>
      }
      <!-- Custom Toast Notification for Copy -->
      @if (copyMessage()) {
        <div class="fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-xl transition duration-300 opacity-90">
            {{ copyMessage() }}
        </div>
      }
    </div>
  `,
  styles: [`
    /* Ensure the app uses the full viewport and Inter font */
    :host {
      display: block;
      min-height: 100vh;
      font-family: 'Inter', sans-serif;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnDestroy {
  // --- ENVIRONMENT VARIABLES ---
  private readonly APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  private readonly FIREBASE_CONFIG_STRING = typeof __firebase_config !== 'undefined' ? __firebase_config : '{}';
  private readonly INITIAL_AUTH_TOKEN = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';


  // --- FIREBASE / AUTH ---
  db!: Firestore;
  auth!: Auth;
  userId = signal<string | null>(null);
  isAuthReady = signal<boolean>(false);
  private systemsUnsubscribe: Unsubscribe | null = null;

  // --- APP STATE ---
  systems = signal<System[]>([]);
  selectedSystemId = signal<string | null>(null); 
  softwareFilter = signal<string>(''); 
  ipError = signal<string | null>(null); 
  macError = signal<string | null>(null);
  copyMessage = signal<string | null>(null); 
  parserMessage = signal<string | null>(null); 
  isProUser = signal<boolean>(false); // PRO user simulation flag
  isAuthenticatedProvider = signal<boolean>(false); // NEW: Tracks if the user logged in via a secure provider
  
  // --- COMPUTED STATE ---
  // Filters out 'Archived' systems for the main dashboard display
  activeSystems = computed(() => {
    return this.systems().filter(s => s.status !== 'Archived');
  });

  selectedSystem = computed(() => {
    const id = this.selectedSystemId();
    if (!id) return null;
    return this.systems().find(s => s.id === id) || null;
  });

  filteredSoftware = computed(() => {
    const system = this.selectedSystem();
    const filterText = this.softwareFilter().toLowerCase().trim();
    if (!system) return [];
    if (!filterText) return system.software;

    return system.software.filter(item => 
      item.name.toLowerCase().includes(filterText) ||
      item.purpose.toLowerCase().includes(filterText) ||
      item.version.toLowerCase().includes(filterText)
    );
  });
  
  sshCommand = computed(() => {
    const system = this.selectedSystem();
    if (!system || !system.ipAddress || !this.validateIpAddress(system.ipAddress)) return null; 
    
    // Checks if any account is explicitly SSH protocol
    const sshAccount = system.accounts.find(a => a.protocol === 'SSH' || a.service.toLowerCase().includes('ssh'));
    const username = sshAccount?.username || 'user'; 
    
    return `ssh ${username}@${system.ipAddress}`;
  });

  rdpLink = computed(() => {
    const system = this.selectedSystem();
    if (!system || !system.ipAddress || !this.validateIpAddress(system.ipAddress) || system.os.join(' ').toLowerCase().indexOf('windows') === -1) return null;
    
    // Checks if any account is explicitly RDP protocol
    const windowsAccount = system.accounts.find(a => a.protocol === 'RDP' || a.service.toLowerCase().includes('rdp'));

    if (windowsAccount) {
        return `rdp://${system.ipAddress}`;
    }
    return null;
  });

  // NEW: Checks if the user is anonymous (requires upgrade)
  isAnonymousUser = computed(() => {
    // If not ready, assume not signed in. Once ready, check if provider is used.
    if (!this.isAuthReady()) return true;
    return !this.isAuthenticatedProvider();
  });
  
  // --- INITIALIZATION & AUTH ---

  constructor() {
    this.initializeFirebase();
    effect(() => {
      if (this.isAuthReady() && this.userId()) {
        this.startSystemListener(this.userId()!);
      } else {
        this.stopSystemListener();
      }
    });
  }
  
  ngOnDestroy(): void {
    this.stopSystemListener();
  }
  
  async initializeFirebase() {
    try {
      let firebaseConfig = null;
      
      // Safely parse the configuration string
      if (this.FIREBASE_CONFIG_STRING && typeof this.FIREBASE_CONFIG_STRING === 'string' && this.FIREBASE_CONFIG_STRING.trim().startsWith('{')) {
          firebaseConfig = JSON.parse(this.FIREBASE_CONFIG_STRING);
      }

      if (!firebaseConfig || !firebaseConfig.apiKey) {
          throw new Error("Firebase configuration not found or invalid (Missing API Key).");
      }
      
      const app = initializeApp(firebaseConfig);
      this.db = getFirestore(app);
      this.auth = getAuth(app);
      
      let userIsProviderAuth = false;

      // 1. Try signing in with the secure initial token (Canvas environment)
      if (this.INITIAL_AUTH_TOKEN) {
        const result = await signInWithCustomToken(this.auth, this.INITIAL_AUTH_TOKEN);
        // We assume if a custom token is provided by the environment, it's authenticated.
        userIsProviderAuth = true; 
      } else {
        // 2. If no token, sign in anonymously to get a UID for Firestore access
        await signInAnonymously(this.auth);
      }
      
      onAuthStateChanged(this.auth, (user) => {
        if (user) {
          this.userId.set(user.uid);
          // Check if the user has a linked provider (i.e., not just anonymous)
          this.isAuthenticatedProvider.set(user.providerData.length > 0 || userIsProviderAuth);
          this.isAuthReady.set(true);
        } else {
          this.userId.set(null);
          this.isAuthenticatedProvider.set(false);
          this.isAuthReady.set(true);
        }
      });
    } catch (error) {
      console.error("Firebase initialization or sign-in failed:", error);
      this.isAuthReady.set(true);
    }
  }

  // NEW: Google Sign-In Method
  async signInWithGoogle() {
      try {
          const provider = new GoogleAuthProvider();
          await signInWithPopup(this.auth, provider);
          // If successful, onAuthStateChanged handles the state update
          this.isAuthenticatedProvider.set(true);
          this.parserMessage.set("Signed in successfully with Google!");
      } catch (error) {
          this.parserMessage.set("Google sign-in failed. Check console for details.");
          console.error("Google sign-in error:", error);
      }
  }

  // --- FIRESTORE OPERATIONS ---

  private getSystemsCollectionPath(uid: string): string {
    return `artifacts/${this.APP_ID}/users/${uid}/systems`;
  }

  private startSystemListener(uid: string) {
    const systemsCollectionRef = collection(this.db, this.getSystemsCollectionPath(uid));
    
    getDocs(query(systemsCollectionRef)).then(snapshot => {
      // FIX: Only populate default data if the user's collection is absolutely empty.
      if (snapshot.empty) {
        this.populateDefaultSystems(uid);
      }
    }).catch(e => console.error("Error checking for initial systems:", e));


    this.systemsUnsubscribe = onSnapshot(systemsCollectionRef, (snapshot) => {
      const loadedSystems: System[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const system: System = {
            id: data['id'],
            name: data['name'] || '',
            role: data['role'] || '',
            model: data['model'] || '',
            specs: data['specs'] || '',
            os: Array.isArray(data['os']) ? data['os'] : (data['os'] ? [data['os']] : []),
            ipAddress: data['ipAddress'] || '',
            macAddress: data['macAddress'] || '',
            location: data['location'] || '',
            status: data['status'] || 'Active', 
            performanceNotes: data['performanceNotes'] || '', 
            accounts: data['accounts'] || [],
            software: data['software'] || [],
            services: data['services'] || [], 
            performanceHistory: data['performanceHistory'] || [],
            tags: data['tags'] || [],
            customProperties: data['customProperties'] || [],
        };
        loadedSystems.push(system);
      });
      
      // Sort by default IDs first, then by alphabetical name for custom IDs
      const fixedOrder = ['example_server', 'example_rpi', 'example_desktop']; 
      const fixedSystems = fixedOrder.map(id => loadedSystems.find(s => s.id === id)).filter((s): s is System => s !== undefined);
      const customSystems = loadedSystems.filter(s => !fixedOrder.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name));

      this.systems.set([...fixedSystems, ...customSystems]);
    }, (error) => {
      console.error("Firestore systems listener failed:", error);
    });
  }

  private stopSystemListener() {
    if (this.systemsUnsubscribe) {
      this.systemsUnsubscribe();
      this.systemsUnsubscribe = null;
    }
    this.systems.set([]);
  }

  private async populateDefaultSystems(uid: string) {
    const systemsCollectionRef = collection(this.db, this.getSystemsCollectionPath(uid));
    // Updated default systems to be generic examples
    const defaultSystems: System[] = [
      {
        id: 'example_server',
        name: 'Example Server (Rename Me)', 
        role: 'Plex Media Server, Docker Host, Remote Access',
        model: 'Generic Rackmount/Laptop',
        specs: 'i7, 32GB DDR4, 1TB NVMe',
        os: ['Linux Server OS', 'Optional Dual Boot'], 
        ipAddress: '192.168.1.10',
        macAddress: 'AA:BB:CC:DD:EE:01',
        location: 'Office Shelf',
        status: 'Active',
        performanceNotes: 'Ready for initial configuration tracking.',
        accounts: [{ name: 'SSH Login', username: 'admin', service: '22', protocol: 'SSH' }],
        software: [{ name: 'Plex', version: '1.x', purpose: 'Media Streaming' }, { name: 'Docker', version: '24.x', purpose: 'Containerization' }],
        services: [{ name: 'Web Panel', portUrl: '9000', notes: 'Docker Management GUI' }, { name: 'Plex Web', portUrl: 'http://192.168.1.10:32400', notes: 'Media Access' }],
        performanceHistory: [],
        customProperties: [],
        tags: ['Server', 'Docker', 'Linux', 'Windows']
      },
      {
        id: 'example_rpi',
        name: 'Example Mini-PC (Rename Me)',
        role: 'Home Automation Hub',
        model: 'Raspberry Pi 4',
        specs: '4GB RAM, 1.5GHz Quad-Core, 64GB MicroSD',
        os: ['Raspberry Pi OS Lite'],
        ipAddress: '192.168.1.5',
        macAddress: 'AA:BB:CC:DD:EE:02',
        location: 'Server Rack Slot 1',
        status: 'Active',
        performanceNotes: 'Low power consumption baseline.',
        accounts: [{ name: 'Admin UI', username: 'piadmin', service: 'Pi-hole Admin UI', protocol: 'HTTPS' }],
        software: [{ name: 'Home Assistant', version: '2023.x', purpose: 'IoT Control' }, { name: 'Pi-hole', version: '5.x', purpose: 'Network-wide ad blocking' }],
        services: [{ name: 'HA UI', portUrl: 'http://192.168.1.5:8123', notes: 'Local control panel' }, { name: 'Pi-hole Admin', portUrl: '192.168.1.5/admin', protocol: 'HTTPS', notes: 'DNS admin interface' }],
        performanceHistory: [],
        customProperties: [],
        tags: ['IoT', 'DNS', 'Linux', 'Mini-PC']
      },
      {
        id: 'example_desktop',
        name: 'Example Workstation (Rename Me)',
        role: 'Daily Driver, Gaming',
        model: 'Custom Build 2024',
        specs: 'Ryzen 7 7700X, 64GB DDR5, RTX 4070 Ti',
        os: ['Windows 11 Pro'],
        ipAddress: '192.168.1.20',
        macAddress: 'AA:BB:CC:DD:EE:03',
        location: 'Office Desk',
        status: 'Active',
        performanceNotes: 'Check GPU driver version before major projects.',
        accounts: [{ name: 'Windows Login', username: 'myusername', service: 'Local Account', protocol: 'RDP' }],
        software: [{ name: 'Adobe Premiere', version: '2023', purpose: 'Video Editing' }, { name: 'Steam', version: 'Latest', purpose: 'Gaming Client' }],
        services: [{ name: 'Plex Desktop Client', portUrl: 'N/A', notes: 'Local client only' }],
        performanceHistory: [],
        customProperties: [],
        tags: ['Gaming', 'Workstation', 'Windows']
      },
    ];

    for (const system of defaultSystems) {
      const docRef = doc(systemsCollectionRef, system.id);
      await setDoc(docRef, system);
    }
  }

  async saveSystem(system: System) {
    const uid = this.userId();
    if (!uid) {
      console.error("Cannot save: User not authenticated.");
      return;
    }
    try {
      const docRef = doc(this.db, this.getSystemsCollectionPath(uid), system.id);
      await setDoc(docRef, system);
    } catch (e) {
      console.error("Error saving document: ", e);
    }
  }
  
  // --- UI ACTIONS ---
  
  selectSystem(id: string) {
    this.selectedSystemId.set(id);
    this.softwareFilter.set('');
    this.ipError.set(null); 
  }

  unselectSystem() {
    this.selectedSystemId.set(null);
  }

  // Function to add a new system with a unique ID
  addNewSystem() {
    if (this.isAnonymousUser()) {
        this.parserMessage.set('Please sign in with Google or another provider to add new devices.');
        return;
    }
    
    // Generate unique ID using crypto.randomUUID() which is safe and standardized
    const newId = crypto.randomUUID(); 
    const newSystem: System = {
        id: newId,
        name: 'New Device (Custom)',
        role: 'Unassigned',
        model: '',
        specs: '',
        os: ['Default OS'],
        ipAddress: '',
        macAddress: '',
        location: '',
        status: 'Active',
        performanceNotes: '',
        accounts: [{ name: 'Default', username: '', service: '', protocol: 'Other' }],
        software: [],
        services: [],
        performanceHistory: [],
        customProperties: [],
        tags: ['Custom']
    };

    // Optimistically update local signal and then save
    this.systems.update(currentSystems => {
      const fixedOrder = ['example_server', 'example_rpi', 'example_desktop']; 
      
      let newSystems = currentSystems.filter(s => s.id !== newId);
      newSystems.push(newSystem);

      const fixedSystems = fixedOrder.map(id => newSystems.find(s => s.id === id)).filter((s): s is System => s !== undefined);
      const customSystems = newSystems.filter(s => !fixedOrder.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name));

      return [...fixedSystems, ...customSystems];
    });

    this.saveSystem(newSystem).then(() => {
        this.selectSystem(newId);
        this.parserMessage.set('New device created! Start entering its details.');
        setTimeout(() => this.parserMessage.set(null), 3000);
    }).catch(e => {
        this.parserMessage.set('Error creating device: Could not save to database.');
        console.error('Error adding new system:', e);
    });
  }

  copyToClipboard(text: string) {
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');

        this.copyMessage.set('Copied to clipboard!');
        setTimeout(() => this.copyMessage.set(null), 2000);
        
        document.body.removeChild(textarea);

    } catch (err) {
        console.error('Failed to copy text: ', err);
        this.copyMessage.set('Copy failed. Please copy manually.');
        setTimeout(() => this.copyMessage.set(null), 2000);
    }
  }

  updateSystemField(field: keyof System, event: Event) {
    const input = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const value = input.value;
    const currentSystem = this.selectedSystem();
    if (!currentSystem) return;
    
    if (field === 'ipAddress' && this.ipError()) {
        console.warn("Attempted to save IP with validation error.");
        return; 
    }
    if (field === 'macAddress' && this.macError()) {
        console.warn("Attempted to save MAC with validation error.");
        return; 
    }

    const updatedSystem: System = { ...currentSystem, [field]: value as any };
    this.saveSystem(updatedSystem);
  }

  updateListItem(listName: 'software' | 'accounts' | 'services', index: number, field: string, event: Event) {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    const value = input.value;
    const currentSystem = this.selectedSystem();
    if (!currentSystem) return;

    const updatedList = (currentSystem as any)[listName].map((item: any, i: number) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });

    const updatedSystem: System = { ...currentSystem, [listName]: updatedList };
    this.saveSystem(updatedSystem);
  }

  addItem(listName: 'software' | 'accounts' | 'services') {
    const currentSystem = this.selectedSystem();
    if (!currentSystem) return;

    let newItem: Account | Software | Service;
    if (listName === 'software') {
      newItem = { name: '', version: '', purpose: '' } as Software;
    } else if (listName === 'accounts') {
      newItem = { name: '', username: '', service: '', protocol: 'Other' } as Account;
    } else { // services
        newItem = { name: '', portUrl: '', notes: '' } as Service;
    }

    const updatedList = [...(currentSystem as any)[listName], newItem];
    const updatedSystem: System = { ...currentSystem, [listName]: updatedList };
    this.saveSystem(updatedSystem);
  }

  removeItem(listName: 'software' | 'accounts' | 'services', index: number) {
    const currentSystem = this.selectedSystem();
    if (!currentSystem) return;

    const updatedList = (currentSystem as any)[listName].filter((_: any, i: number) => i !== index);
    const updatedSystem: System = { ...currentSystem, [listName]: updatedList };
    this.saveSystem(updatedSystem);
  }
  
  // --- CUSTOM PROPERTY MANAGEMENT ---

  addCustomProp() {
    const currentSystem = this.selectedSystem();
    if (!currentSystem) return;

    const newProp: CustomProperty = { key: 'New Field', value: '' };
    const updatedProps = [...currentSystem.customProperties, newProp];
    const updatedSystem: System = { ...currentSystem, customProperties: updatedProps };
    this.saveSystem(updatedSystem);
  }

  updateCustomProp(index: number, field: 'key' | 'value', event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    const currentSystem = this.selectedSystem();
    if (!currentSystem) return;

    const updatedProps = currentSystem.customProperties.map((prop, i) => {
      return i === index ? { ...prop, [field]: value } : prop;
    });

    const updatedSystem: System = { ...currentSystem, customProperties: updatedProps };
    this.saveSystem(updatedSystem);
  }

  removeCustomProp(index: number) {
    const currentSystem = this.selectedSystem();
    if (!currentSystem) return;

    const updatedProps = currentSystem.customProperties.filter((_, i) => i !== index);
    const updatedSystem: System = { ...currentSystem, customProperties: updatedProps };
    this.saveSystem(updatedSystem);
  }

  // --- TAGGING/GROUPING ---

  updateTags(event: Event) {
      const input = event.target as HTMLInputElement;
      const value = input.value;
      const currentSystem = this.selectedSystem();
      if (!currentSystem) return;

      // Split by comma, trim whitespace, filter out empty strings
      const updatedTags = value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      
      const updatedSystem: System = { ...currentSystem, tags: updatedTags };
      this.saveSystem(updatedSystem);
  }

  // --- OS MANAGEMENT ---

  getOriginalSoftwareIndex(item: Software): number {
    const system = this.selectedSystem();
    if (!system) return -1;
    return system.software.findIndex(s => s === item);
  }

  addOsItem() {
    const currentSystem = this.selectedSystem();
    if (!currentSystem) return;

    const updatedOs = [...currentSystem.os, 'New OS'];
    const updatedSystem: System = { ...currentSystem, os: updatedOs };
    this.saveSystem(updatedSystem);
  }

  updateOsItem(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    const currentSystem = this.selectedSystem();
    if (!currentSystem) return;

    const updatedOs = currentSystem.os.map((osName, i) => {
      return i === index ? value : osName;
    });

    const updatedSystem: System = { ...currentSystem, os: updatedOs };
    this.saveSystem(updatedSystem);
  }

  removeOsItem(index: number) {
    const currentSystem = this.selectedSystem();
    if (!currentSystem) return;

    if (currentSystem.os.length === 1) {
        console.warn("Preventing deletion of the last OS item.");
        return;
    }

    const updatedOs = currentSystem.os.filter((_, i) => i !== index);
    const updatedSystem: System = { ...currentSystem, os: updatedOs };
    this.saveSystem(updatedSystem);
  }
  
  // --- PERFORMANCE LOGGING ---

  captureAndClearNotes(inputRef: HTMLTextAreaElement) {
      const notes = inputRef.value;
      const currentSystem = this.selectedSystem();
      
      if (!currentSystem || !notes.trim()) return;

      this.logPerformance(notes);
      this.updateSystemField('performanceNotes', { target: { value: '' }} as any);

      this.parserMessage.set(`Performance snapshot logged successfully!`);
      setTimeout(() => this.parserMessage.set(null), 3000);
      
  }

  logPerformance(notes: string) {
    const currentSystem = this.selectedSystem();
    if (!currentSystem || !notes.trim()) return;

    const newLog: PerformanceLog = {
      timestamp: new Date().toISOString(),
      notes: notes.trim()
    };
    
    const updatedHistory = [newLog, ...currentSystem.performanceHistory];
    const updatedSystem: System = { ...currentSystem, performanceHistory: updatedHistory };
    this.saveSystem(updatedSystem);
  }
  
  // --- SYSTEM INFO PARSER ---
  
  async parsePastedData(data: string, systemId: string) {
    this.parserMessage.set(null);
    if (!data.trim()) {
      this.parserMessage.set('Paste some data first.');
      return;
    }

    const targetSystem = this.systems().find(s => s.id === systemId);
    if (!targetSystem) {
      this.parserMessage.set('Error: Could not find target system.');
      return;
    }

    const lines = data.split('\n');
    let extractedData: Partial<System> = {};
    const specsMap: { [key: string]: string } = {};
    let rawOsList: string[] = [];

    // Mapping key phrases to System fields
    const keyMap: { [key: string]: 'name' | 'model' | 'specs' | 'os' | 'macAddress' } = {
        'device name': 'name',
        'host name': 'name',
        'system model': 'model',
        'baseboard product': 'model',
        'processor': 'specs',
        'installed ram': 'specs',
        'cpu': 'specs',
        'installed physical memory (ram)': 'specs',
        'mac address': 'macAddress',
        'ethernet address': 'macAddress',
        'system type': 'os',
        'edition': 'os',
        'os name': 'os',
        'version': 'os',
    };
    
    // --- Extraction Loop ---
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        const match = trimmedLine.match(/^(.+?)\s{2,}([A-Za-z0-9].*)$/);
        const colonMatch = trimmedLine.match(/^(.+?):\s*([A-Za-z0-9].*)$/);

        let key = '';
        let value = '';

        if (match) {
            key = match[1].trim().toLowerCase().replace(/[\(R\)™]/g, '');
            value = match[2].trim();
        } else if (colonMatch) {
             key = colonMatch[1].trim().toLowerCase().replace(/[\(R\)™]/g, '');
             value = colonMatch[2].trim();
        }
        
        if (key && value) {
            const field = keyMap[key];
            
            if (field) {
                if (field === 'name' && !extractedData.name) {
                    extractedData.name = value;
                } else if (field === 'model' && !extractedData.model) {
                    extractedData.model = value;
                } else if (field === 'macAddress' && !extractedData.macAddress) {
                    extractedData.macAddress = value.toUpperCase().replace(/[^0-9A-F:]/g, '');
                } else if (field === 'specs') {
                    specsMap[key] = value;
                } else if (field === 'os') {
                    rawOsList.push(value);
                }
            }
        }
    }
    
    // 1. Assemble Specs (CPU, RAM, etc.)
    const specsLines = [
        specsMap['processor'] || specsMap['cpu'],
        specsMap['installed ram'] || specsMap['installed physical memory (ram)']
    ].filter(v => v).map(v => v.replace(/\s*\(.*\)/, '').trim());
    
    if (specsLines.length > 0) {
        extractedData.specs = specsLines.join(' | ');
    }
    
    // 2. Assemble OS List
    let finalOsList = targetSystem.os;
    if (rawOsList.length > 0) {
        const uniqueOsEntries = Array.from(new Set(rawOsList))
            .filter(entry => entry.length > 3 && !entry.toLowerCase().includes('64-bit'));
            
        if (uniqueOsEntries.length > 0) {
            if (targetSystem.os.length <= 1 && (targetSystem.os[0] === 'New OS' || targetSystem.os[0] === 'Raspberry Pi OS Lite' || targetSystem.os.length === 0)) {
                 finalOsList = uniqueOsEntries;
            } else {
                 this.parserMessage.set(`Fields parsed, but found existing OS data. Check OS list manually.`);
            }
        }
    }
    
    // 3. Apply updates
    const updatedSystem: System = {
        ...targetSystem,
        name: extractedData.name || targetSystem.name,
        model: extractedData.model || targetSystem.model,
        specs: extractedData.specs || targetSystem.specs,
        macAddress: extractedData.macAddress || targetSystem.macAddress,
        os: finalOsList, 
    };
    
    await this.saveSystem(updatedSystem);
    this.parserMessage.set(`Successfully parsed and updated fields for ${updatedSystem.name}!`);
    setTimeout(() => this.parserMessage.set(null), 3000);
  }

  // --- UTILITIES ---

  private ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  private macRegex = /^[0-9A-F]{2}(?:[-:]?([0-9A-F]{2})){5}$/i;

  validateIpAddress(ip: string): boolean {
    if (!ip.trim()) return true;
    
    if (!this.ipv4Regex.test(ip)) {
      return false;
    }
    
    const parts = ip.split('.');
    for (const part of parts) {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num > 255) {
        return false;
      }
    }
    return true;
  }
  
  validateMacAddress(mac: string): boolean {
    if (!mac.trim()) return true;
    return this.macRegex.test(mac);
  }

  updateAndValidateIp(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    if (!this.validateIpAddress(value) && value.trim() !== '') {
      this.ipError.set('IP Address format is invalid (e.g., 192.168.1.1).');
    } else {
      this.ipError.set(null);
      this.updateSystemField('ipAddress', event);
    }
  }
  
  updateAndValidateMac(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    if (!this.validateMacAddress(value) && value.trim() !== '') {
      this.macError.set('MAC Address format is invalid (e.g., A1:B2:C3:D4:E5:F6).');
    } else {
      this.macError.set(null);
      this.updateSystemField('macAddress', event);
    }
  }

  ipAddressInputClass(ip: string, isDark: boolean = false): string {
    const base = 'mt-1 block w-full rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500';
    const darkInput = isDark ? 'bg-slate-800 text-gray-200 border-gray-600' : 'bg-white text-gray-800 border-gray-300';
    
    if (!ip.trim()) {
        return base + ` ${darkInput}`;
    }
    
    const validationClass = this.validateIpAddress(ip) 
      ? 'border-green-400' 
      : 'border-red-500 focus:border-red-500 focus:ring-red-500';
      
    return base + ` ${darkInput} ` + validationClass;
  }

  macAddressInputClass(mac: string, isDark: boolean = false): string {
    const base = 'mt-1 block w-full rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500';
    const darkInput = isDark ? 'bg-slate-800 text-gray-200 border-gray-600' : 'bg-white text-gray-800 border-gray-300';
    
    if (!mac.trim()) {
        return base + ` ${darkInput}`;
    }
    
    const validationClass = this.validateMacAddress(mac) 
      ? 'border-green-400' 
      : 'border-red-500 focus:border-red-500 focus:ring-red-500';
      
    return base + ` ${darkInput} ` + validationClass;
  }
  
  formatDate(isoString: string): string {
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return isoString;
    }
  }
  
  // --- DATA EXPORT ---
  
  exportData(format: 'json' | 'csv') {
    const data = this.systems();
    const filename = `ForgeTrack_Inventory_${new Date().toISOString().slice(0, 10)}`;
    let blob: Blob;

    const escapeCsv = (val: any): string => {
        if (typeof val === 'string') {
            return `"${val.replace(/"/g, '""')}"`; // Double quotes and wrap in quotes
        }
        return val;
    }
    
    const serializeList = (list: any[], keys: string[]): string => {
        const serialized = list.map(item => {
            const parts = keys.map(key => item[key]);
            return `(${parts.join('/')})`;
        }).join('; ');
        return serialized;
    }


    if (format === 'json') {
      const jsonString = JSON.stringify(data, null, 2);
      blob = new Blob([jsonString], { type: 'application/json' });
      this.parserMessage.set(`Exported ${data.length} systems to JSON.`);
    } else {
      // CSV: Export all main fields PLUS the lists serialized into one column
      const headers = [
        "ID", "Name", "Model", "Status", "IP Address", "MAC Address", "Location", 
        "Tags", 
        "OS List", 
        "Custom Properties (Keys/Values)", 
        "Software List (Name/Version)", 
        "Services List (Name/Port)", 
        "Accounts List (Name/User/Protocol)"
      ];
      let csv = headers.map(escapeCsv).join(',') + '\n';

      data.forEach(system => {
        const row = [
          system.id,
          escapeCsv(system.name),
          escapeCsv(system.model),
          system.status,
          system.ipAddress,
          system.macAddress,
          escapeCsv(system.location),
          escapeCsv(system.tags.join('; ')), // Tags
          escapeCsv(system.os.join('; ')), // OS List
          escapeCsv(serializeList(system.customProperties, ['key', 'value'])), // Custom Props
          escapeCsv(serializeList(system.software, ['name', 'version'])), // Software
          escapeCsv(serializeList(system.services, ['name', 'portUrl'])), // Services
          escapeCsv(serializeList(system.accounts, ['name', 'username', 'protocol'])) // Accounts
        ];
        csv += row.join(',') + '\n';
      });

      blob = new Blob([csv], { type: 'text/csv' });
      this.parserMessage.set(`Exported ${data.length} systems to CSV.`);
    }

    // Trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setTimeout(() => this.parserMessage.set(null), 3000);
  }

  isUrl(text: string): boolean {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return lowerText.startsWith('http') || lowerText.startsWith('https') || lowerText.startsWith('ftp') || lowerText.startsWith('sftp') || lowerText.includes('.') || lowerText.includes(':');
  }

  normalizeUrl(text: string): string {
    if (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('ftp://') || text.startsWith('sftp://') || text.startsWith('rdp://')) {
        return text;
    }
    return `http://${text}`;
  }

  // --- CSS CLASS HELPERS ---

  detailPanelClass = computed(() => {
    return this.selectedSystemId() ? 'translate-x-0' : 'translate-x-full';
  });

  statusBadgeClass(status: SystemStatus): string {
    let base = 'px-3 py-1 rounded-full text-xs font-semibold ';
    switch (status) {
      case 'Active':
        return base + 'bg-green-700/50 text-green-300 border border-green-600';
      case 'Maintenance':
        return base + 'bg-yellow-700/50 text-yellow-300 border border-yellow-600';
      case 'Decommissioned':
        return base + 'bg-red-700/50 text-red-300 border border-red-600';
      case 'Archived':
        return base + 'bg-gray-700/50 text-gray-500 border border-gray-600';
      default:
        return base + 'bg-gray-700/50 text-gray-300 border border-gray-600';
    }
  }

  systemCardClass = (id: string, status: SystemStatus) => {
    let isSelected = this.selectedSystemId() === id;
    let base = 'bg-slate-800 p-6 rounded-xl shadow-xl border-t-4 cursor-pointer transition transform hover:shadow-2xl hover:bg-slate-700 ';
    
    switch (status) {
        case 'Active': base += 'border-t-green-500 shadow-green-900/30 '; break;
        case 'Maintenance': base += 'border-t-yellow-500 shadow-yellow-900/30 '; break;
        case 'Decommissioned': base += 'border-t-red-500 shadow-red-900/30 '; break;
        case 'Archived': base += 'border-t-gray-500 opacity-50 hover:opacity-75 '; break;
    }
    
    base += isSelected ? 'ring-4 ring-offset-2 ring-blue-500 ring-offset-slate-900 scale-[1.02]' : 'hover:scale-[1.01]';
    
    return base;
  }
}
