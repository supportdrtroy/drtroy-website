        // ═══ ADMIN.JS — Main admin panel logic ═══
        console.log('admin.js loaded successfully');

        // ─── GLOBAL ERROR DISPLAY (catches ALL JS errors on the page) ────────
        window.onerror = function(msg, src, line, col, err) {
            var box = document.getElementById('_jsErrors');
            if (!box) {
                box = document.createElement('div');
                box.id = '_jsErrors';
                box.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:#fff;font:bold 13px/1.5 monospace;padding:12px 16px;z-index:999999;max-height:40vh;overflow-y:auto;';
                box.innerHTML = '<b>JS ERRORS DETECTED:</b><br>';
                document.body.appendChild(box);
            }
            box.innerHTML += 'Line ' + line + ': ' + msg + '<br>';
            return false;
        };

        console.log('📄 Admin script loading...');

        // Test if basic functions work
        window.switchMainTab = function(tabName) {
            console.log('🔄 Basic switchMainTab called with:', tabName);
            
            // Remove active from all tabs
            document.querySelectorAll('.main-tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            // Add active to target button
            const targetButton = document.querySelector(`[onclick*="switchMainTab('${tabName}')"]`);
            if (targetButton) {
                targetButton.classList.add('active');
                console.log('✅ Button activated:', tabName);
            }
            
            // Add active to target content
            const targetContent = document.getElementById(tabName);
            if (targetContent) {
                targetContent.classList.add('active');
                console.log('✅ Content activated:', tabName);
            }
        };
        console.log('✅ Basic switchMainTab function defined');
        
        // ─── ADMIN AUTH (Supabase) ────────────────────────────────────────────────
        const SB = window.DrTroySupabase || {};
        // Constants now defined in emergency script above
        let _adminUser   = null;
        let _adminAuthed = false;

        // HTML escape utility — prevents XSS when rendering user-supplied data
        function esc(str) {
            if (str == null) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;');
        }
        // NOTE: Do NOT use const/let here — escapeHtml already exists as a global
        // function from course-management.js. Redeclaring with const causes a
        // SyntaxError that silently kills the entire script.
        var escapeHtml = esc;

        async function checkAuthentication() {
            if (!window.DrTroySupabase) {
                window.location.replace('secure-admin-access-2026.html');
                return false;
            }
            const session = await window.DrTroySupabase.getSession();
            if (session && session.user) {
                const adminFlag = await window.DrTroySupabase.isAdmin(session.user.id);
                if (adminFlag) {
                    _adminUser   = session.user;
                    _adminAuthed = true;
                    return true;
                }
                // Authenticated but not an admin
                alert('Access denied — your account does not have admin privileges.');
                await window.DrTroySupabase.signOut();
            }
            window.location.replace('secure-admin-access-2026.html');
            return false;
        }

        // Logout
        async function logout() {
            if (confirm('Are you sure you want to logout?')) {
                if (window.DrTroySupabase) await window.DrTroySupabase.signOut();
                window.location.replace('secure-admin-access-2026.html');
            }
        }

        // Global data storage
        let employeeCodes  = [];
        let marketingCodes = [];
        let analyticsData  = {};

        // User management state
        let _allUsers          = [];
        let _currentViewedUser = null;

        // ─── VISIBLE DEBUG LOG (survives drop_console minification) ─────────────
        function _dbg(msg) {
            var d = document.getElementById('_adminDebugLog');
            if (!d) {
                d = document.createElement('div');
                d.id = '_adminDebugLog';
                d.style.cssText = 'position:fixed;bottom:0;right:0;width:420px;max-height:260px;overflow-y:auto;background:#111;color:#0f0;font:11px/1.4 monospace;padding:8px;z-index:99999;border:2px solid #0f0;border-radius:8px 0 0 0;opacity:0.92;';
                d.innerHTML = '<b style="color:#ff0">Admin Debug Log</b> <button onclick="this.parentNode.remove()" style="float:right;background:none;color:#f00;border:none;cursor:pointer;font:bold 14px monospace">X</button><hr style="border-color:#333">';
                document.body.appendChild(d);
            }
            var line = document.createElement('div');
            line.textContent = new Date().toLocaleTimeString() + ' ' + msg;
            d.appendChild(line);
            d.scrollTop = d.scrollHeight;
        }

        // Initialize admin dashboard
        async function initAdmin() {
            _dbg('initAdmin started');

            try {
                _dbg('Checking authentication...');

                try {
                    const authed = await checkAuthentication();
                    if (!authed) {
                        _dbg('AUTH FAILED — redirecting');
                        return;
                    }
                    _dbg('AUTH OK — admin verified');
                } catch (authError) {
                    _dbg('AUTH ERROR: ' + (authError.message || authError));
                    // Continue even if auth fails so tabs still work
                }

                try { updateLastUpdate(); } catch(e) { _dbg('Timestamp err: ' + e.message); }
                try { loadStoredData(); } catch(e) { _dbg('StoredData err: ' + e.message); }
                try { createSampleData(); } catch(e) { _dbg('SampleData err: ' + e.message); }
                try { updateStats(); } catch(e) { _dbg('Stats err: ' + e.message); }
                try { updateCodesTable(); } catch(e) { _dbg('CodesTable err: ' + e.message); }
                try { updateAnalytics(); } catch(e) { _dbg('Analytics err: ' + e.message); }

                _dbg('Basic data done. Loading Supabase data...');

                // Load live Supabase data
                if (window.DrTroySupabase) {
                    _dbg('DrTroySupabase available — loading dashboard...');
                    try {
                        await updateDashboard();
                        _dbg('Dashboard OK');
                    } catch(e) { _dbg('Dashboard FAIL: ' + (e.message || e)); }

                    _dbg('Loading users...');
                    try {
                        await loadUsers();
                        _dbg('Users OK (' + (_allUsers ? _allUsers.length : '?') + ' found)');
                    } catch(e) { _dbg('Users FAIL: ' + (e.message || e)); }

                    try {
                        await loadSupabaseRevenue();
                    } catch(e) { _dbg('Revenue FAIL: ' + (e.message || e)); }
                } else {
                    _dbg('WARNING: DrTroySupabase NOT available');
                }

                // Load feature data
                if (window.DrTroySupabase) {
                    _dbg('Loading courses...');
                    try {
                        await refreshCourses();
                        _dbg('Courses OK');
                    } catch(e) { _dbg('Courses FAIL: ' + (e.message || e)); }

                    _dbg('Loading discount codes...');
                    try {
                        await loadDiscountCodesFromDB();
                        _dbg('Discount codes OK');
                    } catch(e) { _dbg('DiscountCodes FAIL: ' + (e.message || e)); }

                    _dbg('Loading license data...');
                    try {
                        await loadLicenseData();
                        _dbg('License data OK');
                    } catch(e) { _dbg('License FAIL: ' + (e.message || e)); }

                    try {
                        await loadCampaignCourses();
                        _dbg('Campaigns OK');
                    } catch(e) { _dbg('Campaigns FAIL: ' + (e.message || e)); }

                    try {
                        await loadWaitlist();
                        _dbg('Waitlist OK');
                    } catch(e) { _dbg('Waitlist FAIL: ' + (e.message || e)); }
                } else {
                    _dbg('Skipping features — no Supabase');
                }

                _dbg('INIT COMPLETE');

                // Replace emergency tab function with enhanced version
                if (typeof switchMainTabEnhanced === 'function') {
                    window.switchMainTab = switchMainTabEnhanced;
                }

            } catch (error) {
                _dbg('FATAL ERROR: ' + (error.message || error));
            }
        }

        // Update last update timestamp and session info
        function updateLastUpdate() {
            const now = new Date();
            document.getElementById('lastUpdate').textContent = now.toLocaleString('en-US', {
                timeZone: 'America/Chicago',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short'
            });
            const sysEl = document.getElementById('systemUpdate');
            if (sysEl) sysEl.textContent = now.toLocaleDateString();
            
            // Update session info
            updateSessionInfo();
        }

        // Update session information — reads from live Supabase session (Supabase auth only)
        async function updateSessionInfo() {
            try {
                const sb = window.DrTroySupabase ? window.DrTroySupabase.getClient() : null;
                if (!sb) return;
                const { data: { session } } = await sb.auth.getSession();
                if (!session) return;
                const statusEl = document.querySelector('.status-indicator');
                if (statusEl) {
                    const expiresAt = new Date(session.expires_at * 1000);
                    const minutesLeft = Math.round((expiresAt - Date.now()) / 60000);
                    statusEl.title = `Logged in as: ${session.user.email}\nSession expires in: ${minutesLeft} min`;
                }
            } catch (e) { /* non-critical */ }
        }

        // extendSession — handled automatically by Supabase autoRefreshToken; no manual action needed.

        // Load data from localStorage
        function loadStoredData() {
            try {
                employeeCodes = JSON.parse(localStorage.getItem('drtroyEmployeeCodes') || '[]');
                marketingCodes = JSON.parse(localStorage.getItem('drtroyMarketingCodes') || '[]');
                analyticsData = JSON.parse(localStorage.getItem('drtroyAnalytics') || '{}');
            } catch (error) {
                console.warn('Error loading data:', error);
                employeeCodes = [];
                marketingCodes = [];
                analyticsData = {};
            }
        }

        // Save data to localStorage
        function saveData() {
            localStorage.setItem('drtroyEmployeeCodes', JSON.stringify(employeeCodes));
            localStorage.setItem('drtroyMarketingCodes', JSON.stringify(marketingCodes));
            localStorage.setItem('drtroyAnalytics', JSON.stringify(analyticsData));
        }

        // Create sample data if none exists
        function createSampleData() {
            if (employeeCodes.length === 0) {
                employeeCodes = [
                    {
                        code: 'EMP-PT-2024001',
                        employeeName: 'Sarah Johnson',
                        employeeType: 'staff',
                        packageType: 'PT',
                        packagePrice: 109,
                        status: 'active',
                        created: new Date().toISOString(),
                        used: false,
                        notes: 'Head PT - annual CE requirement'
                    },
                    {
                        code: 'EMP-OT-2024002',
                        employeeName: 'Michael Chen',
                        employeeType: 'contractor',
                        packageType: 'OT',
                        packagePrice: 109,
                        status: 'used',
                        created: new Date(Date.now() - 86400000).toISOString(),
                        used: true,
                        usedDate: new Date().toISOString()
                    }
                ];
            }

            if (marketingCodes.length === 0) {
                marketingCodes = [
                    {
                        code: 'SPRING25',
                        discountType: 'percentage',
                        discountValue: 25,
                        usageLimit: 'unlimited',
                        maxUses: null,
                        currentUses: 18,
                        campaign: 'Spring 2026 Promotion',
                        status: 'active',
                        created: new Date().toISOString(),
                        expires: null
                    },
                    {
                        code: 'SAVE20',
                        discountType: 'fixed',
                        discountValue: 20,
                        usageLimit: 'limited',
                        maxUses: 100,
                        currentUses: 42,
                        campaign: 'General Discount Campaign',
                        status: 'active',
                        created: new Date(Date.now() - 172800000).toISOString(),
                        expires: null
                    },
                    {
                        code: 'FREEPT',
                        discountType: 'free',
                        discountValue: 100,
                        usageLimit: 'limited',
                        maxUses: 50,
                        currentUses: 12,
                        campaign: 'PT Professional Outreach',
                        status: 'active',
                        created: new Date(Date.now() - 259200000).toISOString(),
                        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                    }
                ];
            }

            saveData();
        }

        // Update statistics
        function updateStats() {
            const totalCodes = employeeCodes.length + marketingCodes.length;
            const activeCodes = employeeCodes.filter(c => c.status === 'active').length + 
                              marketingCodes.filter(c => c.status === 'active').length;
            const usedEmployeeCodes = employeeCodes.filter(c => c.used).length;
            const totalMarketingUses = marketingCodes.reduce((sum, c) => sum + (c.currentUses || 0), 0);
            const totalUses = usedEmployeeCodes + totalMarketingUses;

            // Calculate total savings
            let totalSavings = 0;
            employeeCodes.filter(c => c.used).forEach(c => {
                totalSavings += c.packagePrice;
            });
            marketingCodes.forEach(c => {
                const uses = c.currentUses || 0;
                if (c.discountType === 'percentage') {
                    totalSavings += uses * (99 * (c.discountValue / 100)); // Estimate based on avg package price
                } else if (c.discountType === 'fixed') {
                    totalSavings += uses * c.discountValue;
                } else if (c.discountType === 'free') {
                    totalSavings += uses * 99; // Average package price
                }
            });

            document.getElementById('totalCodes').textContent = totalCodes;
            document.getElementById('activeCodes').textContent = activeCodes;
            document.getElementById('usedCodes').textContent = totalUses;
            document.getElementById('totalSavings').textContent = '$' + Math.round(totalSavings).toLocaleString();
        }

        // Update codes table
        function updateCodesTable() {
            const tableBody = document.getElementById('codesTableBody');
            tableBody.innerHTML = '';

            // Add employee codes
            employeeCodes.forEach(code => {
                const row = tableBody.insertRow();
                row.innerHTML = `
                    <td><strong>${code.code}</strong> <span class="code-badge employee">Employee</span></td>
                    <td>100% off ${code.packageType}</td>
                    <td>$${code.packagePrice}</td>
                    <td>${code.used ? '1/1' : '0/1'}</td>
                    <td><span class="status-badge ${code.status}">${code.status}</span></td>
                    <td>${new Date(code.created).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="viewCodeDetails('${code.code}', 'employee')">View</button>
                        ${code.status === 'active' ? `<button class="btn btn-danger" onclick="deactivateCode('${code.code}', 'employee')">Deactivate</button>` : ''}
                    </td>
                `;
            });

            // Add marketing codes
            marketingCodes.forEach(code => {
                const row = tableBody.insertRow();
                let discountDisplay = code.discountType === 'percentage' ? `${code.discountValue}%` : 
                                    code.discountType === 'fixed' ? `$${code.discountValue}` : '100%';
                let usageDisplay = code.usageLimit === 'unlimited' ? `${code.currentUses}/∞` : 
                                 `${code.currentUses}/${code.maxUses}`;
                
                row.innerHTML = `
                    <td><strong>${code.code}</strong> <span class="code-badge marketing">Marketing</span></td>
                    <td>${discountDisplay} off</td>
                    <td>Variable</td>
                    <td>${usageDisplay}</td>
                    <td><span class="status-badge ${code.status}">${code.status}</span></td>
                    <td>${new Date(code.created).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="viewCodeDetails('${code.code}', 'marketing')">View</button>
                        ${code.status === 'active' ? `<button class="btn btn-danger" onclick="deactivateCode('${code.code}', 'marketing')">Deactivate</button>` : ''}
                    </td>
                `;
            });
        }

        // Update analytics
        function updateAnalytics() {
            const usedEmployeeCodes = employeeCodes.filter(c => c.used).length;
            const totalMarketingUses = marketingCodes.reduce((sum, c) => sum + (c.currentUses || 0), 0);
            const totalSales = usedEmployeeCodes + totalMarketingUses + 32; // Add some organic sales
            
            const monthlyRevenue = totalSales * 92 + Math.floor(Math.random() * 800) + 2500;
            const totalRevenue = monthlyRevenue * 2.8; // Extrapolate
            const activeCustomers = totalSales + Math.floor(Math.random() * 15) + 28;
            const completionRate = Math.min(95, 82 + Math.floor(Math.random() * 12));
            const arpu = Math.round(totalRevenue / activeCustomers);

            // Essential Analytics
            document.getElementById('monthlyRevenue').textContent = '$' + monthlyRevenue.toLocaleString();
            document.getElementById('activeCustomers').textContent = activeCustomers.toLocaleString();
            document.getElementById('completionRate').textContent = completionRate + '%';
            document.getElementById('arpu').textContent = '$' + arpu;

            // Revenue Analytics
            document.getElementById('totalRevenue').textContent = '$' + Math.round(totalRevenue).toLocaleString();
            document.getElementById('ptRevenue').textContent = '$' + Math.round(totalRevenue * 0.48).toLocaleString();
            document.getElementById('otRevenue').textContent = '$' + Math.round(totalRevenue * 0.34).toLocaleString();
            
            // Calculate discount savings
            let discountSavings = 0;
            employeeCodes.filter(c => c.used).forEach(c => discountSavings += c.packagePrice);
            marketingCodes.forEach(c => {
                const uses = c.currentUses || 0;
                if (c.discountType === 'percentage') {
                    discountSavings += uses * (99 * (c.discountValue / 100));
                } else if (c.discountType === 'fixed') {
                    discountSavings += uses * c.discountValue;
                } else if (c.discountType === 'free') {
                    discountSavings += uses * 99;
                }
            });
            document.getElementById('totalDiscountSavings').textContent = '$' + Math.round(discountSavings).toLocaleString();

            // Customer Analytics
            document.getElementById('totalCustomers').textContent = (activeCustomers + Math.floor(Math.random() * 12) + 8).toLocaleString();
            document.getElementById('newCustomers').textContent = Math.floor(activeCustomers * 0.28).toLocaleString();
            document.getElementById('retentionRate').textContent = (87 + Math.floor(Math.random() * 8)) + '%';
            document.getElementById('popularPackage').textContent = 'PT';

            // Marketing Analytics
            const totalPossibleSales = totalSales + Math.floor(Math.random() * 25) + 35;
            const discountUsageRate = Math.round(((usedEmployeeCodes + totalMarketingUses) / totalPossibleSales) * 100);
            document.getElementById('discountUsage').textContent = discountUsageRate + '%';
            
            // Find most used marketing code
            let topCode = marketingCodes.length > 0 ? 
                marketingCodes.reduce((a, b) => (a.currentUses || 0) > (b.currentUses || 0) ? a : b) : null;
            document.getElementById('topCode').textContent = topCode ? topCode.code : '-';
            
            document.getElementById('marketingConversion').textContent = Math.round(discountUsageRate * 0.85) + '%';
            
            const employeeUsageRate = employeeCodes.length > 0 ? 
                Math.round((employeeCodes.filter(c => c.used).length / employeeCodes.length) * 100) : 0;
            document.getElementById('employeeUsage').textContent = employeeUsageRate + '%';

            // Operations Analytics (mostly static/simulated)
            document.getElementById('uptime').textContent = '99.9%';
            document.getElementById('loadTime').textContent = (1.1 + Math.random() * 0.3).toFixed(1) + 's';
            document.getElementById('dbHealth').textContent = 'A+';
            document.getElementById('activeSessions').textContent = Math.floor(Math.random() * 8) + 3;
        }

        // ── Waitlist ──────────────────────────────────────────────
        let waitlistData = [];

        async function loadWaitlist() {
            const tbody = document.getElementById('waitlist-tbody');
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:2rem;">Loading…</td></tr>';
            try {
                const res = await fetch(SUPABASE_URL + '/rest/v1/waitlist?order=signed_up_at.desc&limit=500', {
                    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
                });
                waitlistData = await res.json();
                if (!Array.isArray(waitlistData)) waitlistData = [];
                document.getElementById('waitlist-count').textContent = waitlistData.length + ' signups';
                renderWaitlist(waitlistData);
            } catch(e) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#ef4444;padding:2rem;">Error loading waitlist.</td></tr>';
            }
        }

        function renderWaitlist(data) {
            const tbody = document.getElementById('waitlist-tbody');
            if (!data.length) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:2rem;">No signups yet.</td></tr>';
                return;
            }
            tbody.innerHTML = data.map((r, i) => {
                const firstName = r.first_name || '';
                const lastName  = r.last_name  || '';
                const fullName  = [firstName, lastName].filter(Boolean).join(' ') || '—';
                const disc      = r.discipline  || '—';
                const src       = r.source      || '—';
                const date      = r.signed_up_at
                    ? new Date(r.signed_up_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
                    : '—';
                return `<tr>
                    <td style="color:#94a3b8;font-size:.85rem;">${i + 1}</td>
                    <td style="font-weight:600;color:#1e293b;">${escapeHtml(fullName)}</td>
                    <td style="color:#374151;">${escapeHtml(r.email || '')}</td>
                    <td><span style="background:#e0f2fe;color:#0369a1;padding:.2rem .65rem;border-radius:12px;font-size:.8rem;font-weight:600;">${escapeHtml(disc)}</span></td>
                    <td style="color:#64748b;font-size:.875rem;">${date}</td>
                    <td style="color:#94a3b8;font-size:.8rem;">${escapeHtml(src)}</td>
                    <td>
                        <button class="btn-small danger" onclick="deleteWaitlistEntry('${escapeHtml(r.id)}', '${escapeHtml(r.email || 'this person')}')" title="Delete from waitlist">
                            🗑️ Delete
                        </button>
                    </td>
                </tr>`;
            }).join('');
        }

        function filterWaitlist() {
            const q = document.getElementById('waitlist-search').value.toLowerCase();
            if (!q) { renderWaitlist(waitlistData); return; }
            const filtered = waitlistData.filter(r =>
                (r.email      || '').toLowerCase().includes(q) ||
                (r.first_name || '').toLowerCase().includes(q) ||
                (r.last_name  || '').toLowerCase().includes(q)
            );
            renderWaitlist(filtered);
        }

        async function deleteWaitlistEntry(waitlistId, emailOrName) {
            if (!confirm(`Delete ${emailOrName} from the waitlist?\n\nThis cannot be undone.`)) return;
            
            try {
                const res = await fetch('/.netlify/functions/admin-delete-waitlist', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ id: waitlistId })
                });
                
                const result = await res.json();
                
                if (!res.ok || !result.success) {
                    throw new Error(result.error || 'Failed to delete waitlist entry');
                }
                
                // Remove from local data and re-render
                waitlistData = waitlistData.filter(r => r.id !== waitlistId);
                document.getElementById('waitlist-count').textContent = waitlistData.length + ' signups';
                renderWaitlist(waitlistData);
                
                showAdminToast(`Deleted ${emailOrName} from waitlist`, 'success');
            } catch(e) {
                showAdminToast('Failed to delete: ' + e.message, 'error');
            }
        }

        function exportWaitlistCSV() {
            if (!waitlistData.length) return;
            const header = ['#','First Name','Last Name','Email','Discipline','Signed Up','Source'];
            const rows = waitlistData.map((r, i) => [
                i + 1,
                r.first_name  || '',
                r.last_name   || '',
                r.email       || '',
                r.discipline  || '',
                r.signed_up_at ? new Date(r.signed_up_at).toLocaleDateString() : '',
                r.source      || ''
            ]);
            const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
            const a = document.createElement('a');
            a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
            a.download = 'drtroy-waitlist-' + new Date().toISOString().slice(0,10) + '.csv';
            a.click();
        }

        // Enhanced tab switching with data loading
        function switchMainTabEnhanced(tabName) {
            console.log(`🔄 Switching to tab: ${tabName}`);
            
            try {
                // Update tab buttons - find the correct button by onclick attribute
                document.querySelectorAll('.main-tab').forEach(tab => tab.classList.remove('active'));
                
                // Find and activate the correct tab button
                const targetButton = document.querySelector(`[onclick*="switchMainTab('${tabName}')"]`);
                if (targetButton) {
                    targetButton.classList.add('active');
                    console.log(`✅ Activated button for: ${tabName}`);
                } else {
                    console.warn(`❌ Could not find button for tab: ${tabName}`);
                }
                
                // Update tab content
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                const targetContent = document.getElementById(tabName);
                if (targetContent) {
                    targetContent.classList.add('active');
                    console.log(`✅ Activated content for: ${tabName}`);
                } else {
                    console.warn(`❌ Could not find content for tab: ${tabName}`);
                    return; // Exit if content not found
                }
                
                // Save current tab to localStorage
                try {
                    localStorage.setItem('currentAdminTab', tabName);
                    console.log(`💾 Saved tab: ${tabName}`);
                } catch(e) {
                    console.warn('Could not save tab to localStorage:', e);
                }
                
                // Load data when switching to specific tabs - with error handling
                try {
                    if (tabName === 'dashboard') {
                        updateDashboard().catch(e => console.warn('Dashboard load error:', e));
                    } else if (tabName === 'users') {
                        loadUsers().catch(e => console.warn('Users load error:', e));
                    } else if (tabName === 'courses') {
                        loadCourses().catch(e => console.warn('Courses load error:', e));
                    } else if (tabName === 'emails') {
                        loadEmailData();
                    } else if (tabName === 'licenses') {
                        loadLicenseData().catch(e => console.warn('License data load error:', e));
                    } else if (tabName === 'discount-codes') {
                        loadDiscountCodesFromDB().catch(e => console.warn('Discount codes load error:', e));
                    } else if (tabName === 'waitlist') {
                        loadWaitlist().catch(e => console.warn('Waitlist load error:', e));
                    }
                } catch (dataLoadError) {
                    console.warn(`Tab data loading error for ${tabName}:`, dataLoadError);
                }
            } catch (error) {
                console.error(`Error switching to tab ${tabName}:`, error);
                alert(`Error switching to ${tabName} tab. Check console for details.`);
            }
        }

        // Restore saved tab on page load
        function restoreSavedTab() {
            const savedTab = localStorage.getItem('currentAdminTab');
            if (savedTab) {
                switchMainTab(savedTab);
            }
            // If no saved tab, leave the default HTML active state
        }

        function switchSubTab(tabName) {
            // Find the parent tab container to scope the search
            const activeMainTab = document.querySelector('.tab-content.active');
            if (!activeMainTab) return;
            
            // Update sub-tab buttons within the active main tab
            activeMainTab.querySelectorAll('.sub-tab').forEach(tab => tab.classList.remove('active'));
            const targetButton = activeMainTab.querySelector(`[onclick*="switchSubTab('${tabName}')"]`);
            if (targetButton) {
                targetButton.classList.add('active');
            }
            
            // Update sub-tab content within the active main tab
            activeMainTab.querySelectorAll('.sub-content').forEach(content => content.classList.remove('active'));
            const targetContent = activeMainTab.querySelector(`#${tabName}`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        }

        function switchAnalyticsTab(tabName) {
            // Find the analytics tab container
            const analyticsTab = document.getElementById('analytics');
            if (!analyticsTab) return;
            
            // Update sub-tab buttons within the analytics tab
            analyticsTab.querySelectorAll('.sub-tab').forEach(tab => tab.classList.remove('active'));
            const targetButton = analyticsTab.querySelector(`[onclick*="switchAnalyticsTab('${tabName}')"]`);
            if (targetButton) {
                targetButton.classList.add('active');
            }
            
            // Update sub-tab content within the analytics tab
            analyticsTab.querySelectorAll('.sub-content').forEach(content => content.classList.remove('active'));
            const targetContent = analyticsTab.querySelector(`#${tabName}-analytics`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        }

        // Form handlers
        document.getElementById('employeeForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const employeeName = document.getElementById('employeeName').value;
            const employeeType = document.getElementById('employeeType').value;
            const packageType = document.getElementById('employeePackage').value;
            const notes = document.getElementById('employeeNotes').value;
            
            if (!employeeName || !employeeType || !packageType) {
                showMessage('employeeError', 'Please fill in all required fields.');
                return;
            }
            
            // Generate unique code
            const timestamp = Date.now().toString().slice(-6);
            const newCode = `EMP-${packageType}-${new Date().getFullYear()}${timestamp}`;
            
            const packagePrices = { 'PT': 109, 'PTA': 89, 'OT': 109, 'COTA': 89 };
            
            const employeeCode = {
                code: newCode,
                employeeName: employeeName,
                employeeType: employeeType,
                packageType: packageType,
                packagePrice: packagePrices[packageType],
                notes: notes,
                status: 'active',
                created: new Date().toISOString(),
                used: false
            };
            
            employeeCodes.push(employeeCode);
            saveData();
            updateStats();
            updateCodesTable();
            
            showMessage('employeeSuccess', `✅ Employee code "${newCode}" created successfully for ${employeeName}!`);
            
            this.reset();
        });

        document.getElementById('marketingForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const codeName     = document.getElementById('marketingCodeName').value.toUpperCase();
            const discountType = document.getElementById('marketingDiscountType').value;
            const discountValue= document.getElementById('marketingDiscountValue').value;
            const usageLimit   = document.getElementById('marketingUsageLimit').value;
            const maxUses      = document.getElementById('marketingMaxUses').value;
            const startDate    = document.getElementById('marketingStartDate').value;
            const expiry       = document.getElementById('marketingExpiry').value;
            const campaign     = document.getElementById('marketingCampaign').value;
            const newOnly      = document.getElementById('marketingNewOnly').checked;

            if (!codeName || !discountType || (discountType !== 'free' && !discountValue)) {
                showMessage('marketingError', 'Please fill in all required fields.');
                return;
            }

            if (marketingCodes.find(c => c.code === codeName) || employeeCodes.find(c => c.code === codeName)) {
                showMessage('marketingError', 'Code name already exists. Please choose a different name.');
                return;
            }

            const discVal = discountType === 'free' ? 100 : parseInt(discountValue);
            const record  = {
                code:               codeName,
                description:        campaign || 'Marketing promotion',
                campaign_name:      campaign || null,
                discount_type:      discountType,
                discount_value:     discVal,
                applies_to:         'all',
                max_uses:           usageLimit === 'limited' ? parseInt(maxUses) : (usageLimit === 'single' ? 1 : null),
                current_uses:       0,
                is_active:          true,
                starts_at:          startDate ? new Date(startDate).toISOString() : null,
                expires_at:         expiry    ? new Date(expiry + 'T23:59:59').toISOString() : null,
                new_customers_only: newOnly
            };

            // Save to Supabase
            const res = await fetch(SUPABASE_URL + '/rest/v1/discount_codes', {
                method:  'POST',
                headers: {
                    'apikey':        SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                    'Content-Type':  'application/json',
                    'Prefer':        'return=minimal'
                },
                body: JSON.stringify(record)
            });

            if (!res.ok) {
                showMessage('marketingError', 'Error saving code. Please try again.');
                return;
            }

            // Also update local state for display
            marketingCodes.push({ ...record, discountType, discountValue: discVal, campaign, expires: expiry || null, status: 'active', created: new Date().toISOString() });
            saveData();
            updateStats();
            updateCodesTable();

            showMessage('marketingSuccess', `🚀 Code "${codeName}" created!${newOnly ? ' (new customers only)' : ''}${expiry ? ' Expires ' + expiry + '.' : ''}`);
            this.reset();
        });

        async function createFoundingMemberOffer() {
            const start   = new Date();
            const end     = new Date(start);
            end.setDate(end.getDate() + 30);
            const fmt = d => d.toISOString().slice(0, 10);

            const record = {
                code:               'FOUNDING10',
                description:        'Founding Member Offer — $10 off for new customers',
                campaign_name:      'Founding Member — 30 Day Launch Offer',
                discount_type:      'fixed',
                discount_value:     10,
                applies_to:         'all',
                max_uses:           null,
                current_uses:       0,
                is_active:          true,
                starts_at:          start.toISOString(),
                expires_at:         new Date(fmt(end) + 'T23:59:59').toISOString(),
                new_customers_only: true
            };

            const res = await fetch(SUPABASE_URL + '/rest/v1/discount_codes', {
                method:  'POST',
                headers: {
                    'apikey':        SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                    'Content-Type':  'application/json',
                    'Prefer':        'return=minimal'
                },
                body: JSON.stringify(record)
            });

            if (res.ok || res.status === 201) {
                marketingCodes.push({ code: 'FOUNDING10', discountType: 'fixed', discountValue: 10, campaign: record.campaign_name, expires: fmt(end), status: 'active', created: start.toISOString(), newOnly: true });
                saveData(); updateStats(); updateCodesTable();
                showMessage('marketingSuccess', '🎉 Founding Member offer created! Code: FOUNDING10 — valid for 30 days, new customers only.');
            } else {
                showMessage('marketingError', 'Error creating offer. Code FOUNDING10 may already exist.');
            }
        }


        // Utility functions
        function showMessage(elementId, message) {
            const element = document.getElementById(elementId);
            element.textContent = message;
            element.style.display = 'block';
            setTimeout(() => {
                element.style.display = 'none';
            }, 5000);
        }

        function viewCodeDetails(code, type) {
            const codeData = type === 'employee' ? 
                employeeCodes.find(c => c.code === code) : 
                marketingCodes.find(c => c.code === code);
            
            if (codeData) {
                let details = `Code: ${codeData.code}\nType: ${type}\nStatus: ${codeData.status}\nCreated: ${new Date(codeData.created).toLocaleString()}`;
                
                if (type === 'employee') {
                    details += `\nEmployee: ${codeData.employeeName}\nPackage: ${codeData.packageType} ($${codeData.packagePrice})`;
                    if (codeData.notes) details += `\nNotes: ${codeData.notes}`;
                } else {
                    details += `\nDiscount: ${codeData.discountValue}${codeData.discountType === 'percentage' ? '%' : codeData.discountType === 'fixed' ? ' dollars' : '% (free)'}`;
                    details += `\nUsage: ${codeData.currentUses}${codeData.maxUses ? '/' + codeData.maxUses : '/unlimited'}`;
                    details += `\nCampaign: ${codeData.campaign}`;
                }
                
                alert(details);
            }
        }

        function deactivateCode(code, type) {
            if (confirm(`Are you sure you want to deactivate code "${code}"?`)) {
                if (type === 'employee') {
                    const codeData = employeeCodes.find(c => c.code === code);
                    if (codeData) codeData.status = 'inactive';
                } else {
                    const codeData = marketingCodes.find(c => c.code === code);
                    if (codeData) codeData.status = 'inactive';
                }
                saveData();
                updateStats();
                updateCodesTable();
            }
        }

        function exportData() {
            const exportData = {
                employeeCodes: employeeCodes,
                marketingCodes: marketingCodes,
                analyticsData: analyticsData,
                exportDate: new Date().toISOString(),
                version: '1.0.0'
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `drtroy-admin-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            alert('✅ Data exported successfully!');
        }

        function clearSampleData() {
            if (confirm('This will remove all sample data but keep your custom codes. Continue?')) {
                employeeCodes = employeeCodes.filter(c => !c.code.startsWith('EMP-PT-2024') && !c.code.startsWith('EMP-OT-2024'));
                marketingCodes = marketingCodes.filter(c => !['SPRING25', 'SAVE20', 'FREEPT'].includes(c.code));
                saveData();
                updateStats();
                updateCodesTable();
                alert('✅ Sample data cleared!');
            }
        }

        function resetToDefaults() {
            if (confirm('This will delete ALL data and restore sample codes. This cannot be undone. Continue?')) {
                localStorage.removeItem('drtroyEmployeeCodes');
                localStorage.removeItem('drtroyMarketingCodes');
                localStorage.removeItem('drtroyAnalytics');
                
                employeeCodes = [];
                marketingCodes = [];
                analyticsData = {};
                
                createSampleData();
                updateStats();
                updateCodesTable();
                updateAnalytics();
                
                alert('✅ Reset complete! Sample data restored.');
            }
        }

        // Enhanced Tab Switching Functions
        function switchEmailTab(tabName) {
            const emailsTab = document.getElementById('emails');
            if (!emailsTab) return;
            
            // Update sub-tab buttons within the emails tab
            emailsTab.querySelectorAll('.sub-tab').forEach(tab => tab.classList.remove('active'));
            const targetButton = emailsTab.querySelector(`[onclick*="switchEmailTab('${tabName}')"]`);
            if (targetButton) {
                targetButton.classList.add('active');
            }
            
            // Update sub-tab content within the emails tab
            emailsTab.querySelectorAll('.sub-content').forEach(content => content.classList.remove('active'));
            const targetContent = emailsTab.querySelector(`#email-${tabName}`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        }


        // Dashboard Functions
        // Dashboard stats — pull from Supabase
        async function updateDashboard() {
            try {
                const result = await SB.adminAction('get_dashboard', {});
                if (result.error) {
                    _dbg('Dashboard error: ' + result.error);
                    return;
                }

                const stats = result.data || {};
                _dbg('Dashboard data: users=' + stats.totalUsers + ' rev=' + stats.revenue + ' comp=' + stats.totalCompletions);

                const totalEl    = document.getElementById('totalUsers');
                const revenueEl  = document.getElementById('monthlyRevenue');
                const complEl    = document.getElementById('courseCompletions');

                if (totalEl)   totalEl.textContent   = stats.totalUsers || 0;
                if (revenueEl) revenueEl.textContent  = '$' + (stats.revenue || 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
                if (complEl)   complEl.textContent    = stats.totalCompletions || 0;

            } catch (err) {
                _dbg('Dashboard EXCEPTION: ' + (err.message || err));
            }
        }

        // Load Supabase revenue into dashboard — now handled by updateDashboard via Netlify function
        async function loadSupabaseRevenue() {
            // Revenue is now fetched via the get_dashboard admin action
            // This function is kept for backwards compatibility but does nothing
        }

        // ─── USER MANAGEMENT — REAL IMPLEMENTATIONS ───────────────────────────────

        async function loadUsers() {
            const tbody = document.getElementById('usersTableBody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:2rem;">Loading users from database...</td></tr>';

            try {
                _dbg('loadUsers: calling adminAction...');
                const result = await SB.adminAction('get_users', {});
                _dbg('loadUsers result: ' + JSON.stringify(result).substring(0, 200));
                if (result.error) {
                    _dbg('loadUsers ERROR: ' + result.error);
                    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#dc2626;padding:2rem;">Failed to load users: ' + esc(result.error) + '</td></tr>';
                    return;
                }

                _allUsers = (result.data && result.data.users) || [];
                _dbg('loadUsers: ' + _allUsers.length + ' users loaded');
                renderUsersTable(_allUsers);
            } catch (err) {
                _dbg('loadUsers EXCEPTION: ' + (err.message || err));
                if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#dc2626;padding:2rem;">Error loading users: ' + esc(err.message || 'Unknown error') + '</td></tr>';
            }
        }

        function renderUsersTable(users) {
            const tbody = document.getElementById('usersTableBody');
            if (!tbody) return;

            if (!users || !users.length) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:2rem;">No users found.</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            users.forEach(u => {
                const name = esc([u.first_name, u.last_name].filter(Boolean).join(' ') || '(no name)');
                const roleBadge = u.is_admin
                    ? '<span class="badge-admin">Admin</span>'
                    : '<span class="badge-user">User</span>';
                const suspBadge = u.is_suspended
                    ? ' <span class="badge-suspended">Suspended</span>'
                    : '';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${name}</td>
                    <td style="font-size:0.9rem;">${esc(u.email) || '—'}</td>
                    <td>${esc(u.profession) || '—'}</td>
                    <td>${esc(u.license_number) || '—'}</td>
                    <td>${esc(u.license_state) || '—'}</td>
                    <td>${roleBadge}${suspBadge}</td>
                    <td style="white-space:nowrap;">
                        <button class="btn-small" onclick="viewUser('${esc(u.id)}')">👁️ View</button>
                        <button class="btn-small ${u.is_admin ? 'warning' : ''}"
                            onclick="quickToggleAdmin('${esc(u.id)}', ${!!u.is_admin})"
                            style="margin-left:4px;">
                            ${u.is_admin ? '🛡️ Remove Admin' : 'Make Admin'}
                        </button>
                        ${!u.is_admin ? `<button class="btn-small danger"
                            onclick="deleteAdminUser('${esc(u.id)}', '${esc([u.first_name, u.last_name].filter(Boolean).join(' ') || u.email)}')"
                            style="margin-left:4px;">🗑️ Delete</button>` : ''}
                    </td>`;
                tbody.appendChild(tr);
            });
        }

        async function deleteAdminUser(userId, name) {
            if (!confirm(`Delete user "${name}"?\n\nThis permanently removes their account, enrollments, and all data. This cannot be undone.`)) return;
            try {
                const sb = window.DrTroySupabase ? window.DrTroySupabase.getClient() : null;
                if (!sb) { showAdminToast('Session error', 'error'); return; }
                const session = (await sb.auth.getSession()).data.session;
                const res = await fetch('/.netlify/functions/admin-actions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({ action: 'delete_user', payload: { userId } })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Delete failed');
                showAdminToast(`User "${name}" deleted successfully.`, 'success');
                await loadUsers();
            } catch (err) {
                showAdminToast('Delete failed: ' + err.message, 'error');
            }
        }

        function filterUsers() {
            const query      = (document.getElementById('userSearch')?.value || '').toLowerCase().trim();
            const profFilter = document.getElementById('userFilter')?.value || 'all';

            let filtered = _allUsers;
            if (query) {
                filtered = filtered.filter(u => {
                    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').toLowerCase();
                    return name.includes(query)
                        || (u.email || '').toLowerCase().includes(query)
                        || (u.license_number || '').toLowerCase().includes(query);
                });
            }
            if (profFilter !== 'all') {
                filtered = filtered.filter(u => u.profession === profFilter);
            }
            renderUsersTable(filtered);
        }

        function exportUsers() {
            if (!_allUsers.length) {
                showAdminToast('No users loaded yet — please wait for the table to populate.', 'error');
                return;
            }
            window.DrTroySupabase.adminExportUsersCSV(_allUsers);
        }

        function showAddUserForm() {
            document.getElementById('addUserModal').classList.add('active');
        }

        function closeAddUserModal() {
            document.getElementById('addUserModal').classList.remove('active');
            const form = document.getElementById('addUserForm');
            if (form) form.reset();
            document.getElementById('addUserError').style.display = 'none';
            document.getElementById('addUserSuccess').style.display = 'none';
            const btn = document.getElementById('au-submit-btn');
            if (btn) { btn.disabled = false; btn.textContent = '✅ Create Account'; }
        }

        async function submitAddUser() {
            const email       = document.getElementById('au-email').value.trim();
            const password    = document.getElementById('au-password').value;
            const firstName   = document.getElementById('au-first-name').value.trim();
            const lastName    = document.getElementById('au-last-name').value.trim();
            const profession  = document.getElementById('au-profession').value;
            const licenseNumber = document.getElementById('au-license').value.trim();
            const state       = (document.getElementById('au-state').value || '').trim().toUpperCase();

            const errEl = document.getElementById('addUserError');
            const okEl  = document.getElementById('addUserSuccess');
            errEl.style.display = 'none';
            okEl.style.display = 'none';

            if (!email || !password || !firstName || !lastName || !profession) {
                errEl.textContent = 'Please fill in all required fields (marked *).';
                errEl.style.display = 'block';
                return;
            }
            if (password.length < 8) {
                errEl.textContent = 'Password must be at least 8 characters.';
                errEl.style.display = 'block';
                return;
            }

            const btn = document.getElementById('au-submit-btn');
            btn.disabled = true;
            btn.textContent = 'Creating account...';

            const result = await window.DrTroySupabase.adminAction('create_user', {
                email, password, firstName, lastName, profession, licenseNumber, state
            });

            btn.disabled = false;
            btn.textContent = '✅ Create Account';

            if (result.error) {
                errEl.textContent = '❌ ' + result.error;
                errEl.style.display = 'block';
            } else {
                okEl.textContent = '✅ Account created successfully! The user can now log in.';
                okEl.style.display = 'block';
                document.getElementById('addUserForm').reset();
                await loadUsers();
                setTimeout(closeAddUserModal, 3000);
            }
        }

        // ─── VIEW USER DETAIL MODAL ────────────────────────────────────────────────

        async function viewUser(userId) {
            try {
                const user = _allUsers.find(u => u.id === userId);
                if (!user) {
                    showAdminToast('User not found.', 'error');
                    return;
                }
                _currentViewedUser = user;
                await populateUserDetailModal(_currentViewedUser);
                const modal = document.getElementById('userDetailModal');
                if (!modal) { showAdminToast('Modal element missing — contact support.', 'error'); return; }
                modal.classList.add('active');
            } catch(err) {
                showAdminToast('Could not open user: ' + err.message, 'error');
            }
        }

        function closeUserDetailModal() {
            document.getElementById('userDetailModal').classList.remove('active');
            _currentViewedUser = null;
        }

        async function populateUserDetailModal(user) {
            // Header
            const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || '(no name)';
            document.getElementById('udm-name').textContent    = name;
            document.getElementById('udm-email').textContent   = user.email || '';
            document.getElementById('udm-created').textContent = user.created_at
                ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : '—';

            // Badges
            const roleBadge = document.getElementById('udm-role-badge');
            roleBadge.className = user.is_admin ? 'badge-admin' : 'badge-user';
            roleBadge.textContent = user.is_admin ? 'Admin' : 'User';

            const suspBadge = document.getElementById('udm-suspended-badge');
            if (user.is_suspended) {
                suspBadge.style.display = 'inline-block';
                suspBadge.textContent = 'Suspended';
            } else {
                suspBadge.style.display = 'none';
            }

            // Editable fields
            document.getElementById('udm-first-name').value  = user.first_name  || '';
            document.getElementById('udm-last-name').value   = user.last_name   || '';
            document.getElementById('udm-license').value     = user.license_number || '';
            document.getElementById('udm-state').value       = user.license_state || user.state || '';
            document.getElementById('udm-profession').value  = user.profession  || '';

            // Toggle Admin button
            const adminBtn = document.getElementById('udm-toggle-admin-btn');
            adminBtn.textContent = user.is_admin ? '🛡️ Remove Admin' : '🛡️ Grant Admin';
            adminBtn.className   = user.is_admin ? 'btn btn-danger' : 'btn btn-primary';

            // Suspend button
            const suspBtn = document.getElementById('udm-suspend-btn');
            suspBtn.textContent = user.is_suspended ? '✅ Unsuspend User' : '⚠️ Suspend User';
            suspBtn.className   = user.is_suspended ? 'btn btn-success' : 'btn btn-warning';

            // Clear status message
            const statusEl = document.getElementById('udm-status');
            statusEl.style.display = 'none';
            statusEl.textContent = '';

            // License expiry
            document.getElementById('udm-license-expiry').value = user.license_expiry_date || '';

            // Enrollments
            const { data: enrollments } = await window.DrTroySupabase.adminGetUserEnrollments(user.id);
            renderUserEnrollments(enrollments || []);

            // Course picker
            await buildEnrollPicker(user.id, enrollments || []);

            // Certificates
            await loadUserCertificates(user.id);
        }

        function renderUserEnrollments(enrollments) {
            const container = document.getElementById('udm-enrollments');
            if (!enrollments.length) {
                container.innerHTML = '<p style="color:#6b7280;font-style:italic;">No enrollments yet.</p>';
                return;
            }
            container.innerHTML = enrollments.map(e => {
                const title    = esc(e.courses?.title || 'Unknown Course');
                const hours    = esc(String(e.courses?.ceu_hours || 0));
                const date     = e.purchased_at ? new Date(e.purchased_at).toLocaleDateString() : '—';
                const paidCents = parseInt(e.amount_paid_cents || 0, 10);
                const paidDollars = (paidCents / 100).toFixed(2);
                // Admin grant: no stripe payment AND $0 paid
                const isAdminGrant = !e.stripe_payment_intent_id && paidCents === 0;
                const method   = isAdminGrant ? 'Admin Grant' : ('$' + esc(paidDollars));
                const safeId   = esc(e.id);
                return `
                    <div class="enrollment-row">
                        <div>
                            <strong>${title}</strong>
                            <div style="font-size:0.82rem;color:#6b7280;">${hours} CEU hrs &bull; ${date} &bull; ${method}</div>
                        </div>
                        <button class="btn-small danger" onclick="removeEnrollment('${safeId}')">Remove</button>
                    </div>`;
            }).join('');
        }

        async function buildEnrollPicker(userId, existing) {
            const section = document.getElementById('udm-enroll-section');
            const { data: allCourses } = await window.DrTroySupabase.adminGetAllCourses();
            const enrolledIds = (existing || []).map(e => e.course_id);
            const available   = (allCourses || []).filter(c => !enrolledIds.includes(c.id));

            if (!available.length) {
                section.innerHTML = '<p style="color:#6b7280;font-style:italic;">User is enrolled in all available courses.</p>';
                return;
            }

            const select = document.getElementById('udm-course-select');
            select.innerHTML = '<option value="">Select a course...</option>';
            available.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `${c.title} (${c.ceu_hours} CEUs)`;
                select.appendChild(opt);
            });
            section.style.display = '';
        }

        async function saveUserProfile() {
            if (!_currentViewedUser) return;
            const updates = {
                first_name:     document.getElementById('udm-first-name').value.trim(),
                last_name:      document.getElementById('udm-last-name').value.trim(),
                license_number: document.getElementById('udm-license').value.trim(),
                license_state:  document.getElementById('udm-state').value.trim().toUpperCase(),
                profession:     document.getElementById('udm-profession').value,
            };
            showUDMStatus('Saving changes...', 'info');
            const { error } = await window.DrTroySupabase.updateProfile(_currentViewedUser.id, updates);
            if (error) {
                showUDMStatus('❌ Save failed: ' + error.message, 'error');
            } else {
                Object.assign(_currentViewedUser, updates);
                const idx = _allUsers.findIndex(u => u.id === _currentViewedUser.id);
                if (idx >= 0) Object.assign(_allUsers[idx], updates);
                renderUsersTable(_allUsers);
                showUDMStatus('✅ Profile saved successfully!', 'success');
            }
        }

        async function toggleAdmin() {
            if (!_currentViewedUser) return;
            const makeAdmin = !_currentViewedUser.is_admin;
            const verb = makeAdmin ? 'grant admin access to' : 'remove admin from';
            if (!confirm(`Are you sure you want to ${verb} ${_currentViewedUser.email}?`)) return;

            showUDMStatus('Updating admin status...', 'info');
            const result = await window.DrTroySupabase.adminAction('toggle_admin', {
                userId: _currentViewedUser.id, makeAdmin
            });
            if (result.error) {
                showUDMStatus('❌ Failed: ' + result.error, 'error');
                return;
            }
            _currentViewedUser.is_admin = makeAdmin;
            const idx = _allUsers.findIndex(u => u.id === _currentViewedUser.id);
            if (idx >= 0) _allUsers[idx].is_admin = makeAdmin;

            // Update modal UI
            const roleBadge = document.getElementById('udm-role-badge');
            roleBadge.className = makeAdmin ? 'badge-admin' : 'badge-user';
            roleBadge.textContent = makeAdmin ? 'Admin' : 'User';
            const adminBtn = document.getElementById('udm-toggle-admin-btn');
            adminBtn.textContent = makeAdmin ? '🛡️ Remove Admin' : '🛡️ Grant Admin';
            adminBtn.className   = makeAdmin ? 'btn btn-danger' : 'btn btn-primary';

            renderUsersTable(_allUsers);
            showUDMStatus(`✅ Admin ${makeAdmin ? 'granted' : 'removed'} successfully!`, 'success');
        }

        async function toggleSuspend() {
            if (!_currentViewedUser) return;
            const suspend = !_currentViewedUser.is_suspended;
            const verb = suspend ? 'suspend' : 'unsuspend';
            if (!confirm(`Are you sure you want to ${verb} ${_currentViewedUser.email}?`)) return;

            showUDMStatus('Updating suspension status...', 'info');
            const result = await window.DrTroySupabase.adminAction('suspend_user', {
                userId: _currentViewedUser.id, suspend
            });
            if (result.error) {
                showUDMStatus('❌ Failed: ' + result.error, 'error');
                return;
            }
            _currentViewedUser.is_suspended = suspend;
            const idx = _allUsers.findIndex(u => u.id === _currentViewedUser.id);
            if (idx >= 0) _allUsers[idx].is_suspended = suspend;

            const suspBadge = document.getElementById('udm-suspended-badge');
            if (suspend) {
                suspBadge.style.display = 'inline-block';
                suspBadge.textContent = 'Suspended';
            } else {
                suspBadge.style.display = 'none';
            }
            const suspBtn = document.getElementById('udm-suspend-btn');
            suspBtn.textContent = suspend ? '✅ Unsuspend User' : '⚠️ Suspend User';
            suspBtn.className   = suspend ? 'btn btn-success' : 'btn btn-warning';

            renderUsersTable(_allUsers);
            showUDMStatus(`✅ User ${suspend ? 'suspended' : 'unsuspended'} successfully!`, 'success');
        }

        async function deleteUserAccount() {
            if (!_currentViewedUser) return;
            if (!confirm(`⚠️ Permanently delete ${_currentViewedUser.email}? This cannot be undone!`)) return;
            if (!confirm('Final confirmation: this will delete the account and all associated data.')) return;

            showUDMStatus('Deleting user account...', 'info');
            const result = await window.DrTroySupabase.adminAction('delete_user', {
                userId: _currentViewedUser.id
            });
            if (result.error) {
                showUDMStatus('❌ Delete failed: ' + result.error, 'error');
                return;
            }
            const deletedEmail = _currentViewedUser.email;
            _allUsers = _allUsers.filter(u => u.id !== _currentViewedUser.id);
            renderUsersTable(_allUsers);
            closeUserDetailModal();
            showAdminToast(`✅ User ${deletedEmail} has been permanently deleted.`, 'success');
        }

        async function manualEnroll() {
            if (!_currentViewedUser) return;
            const courseId = document.getElementById('udm-course-select')?.value;
            if (!courseId) { showUDMStatus('Please select a course first.', 'error'); return; }

            showUDMStatus('Enrolling user...', 'info');
            const result = await window.DrTroySupabase.adminAction('manual_enroll', {
                userId: _currentViewedUser.id, courseId
            });
            if (result.error) {
                showUDMStatus('❌ Enrollment failed: ' + result.error, 'error');
            } else {
                showUDMStatus('✅ User enrolled successfully!', 'success');
                // Reload the enrollments section
                const { data: enrollments } = await window.DrTroySupabase.adminGetUserEnrollments(_currentViewedUser.id);
                renderUserEnrollments(enrollments || []);
                await buildEnrollPicker(_currentViewedUser.id, enrollments || []);
            }
        }

        async function removeEnrollment(enrollmentId) {
            if (!confirm('Remove this enrollment? The user will lose access to this course.')) return;
            showUDMStatus('Removing enrollment...', 'info');
            const result = await window.DrTroySupabase.adminAction('remove_enrollment', { enrollmentId });
            if (result.error) {
                showUDMStatus('❌ Failed: ' + result.error, 'error');
            } else {
                showUDMStatus('✅ Enrollment removed.', 'success');
                const { data: enrollments } = await window.DrTroySupabase.adminGetUserEnrollments(_currentViewedUser.id);
                renderUserEnrollments(enrollments || []);
                await buildEnrollPicker(_currentViewedUser.id, enrollments || []);
            }
        }

        async function quickToggleAdmin(userId, currentIsAdmin) {
            const user = _allUsers.find(u => u.id === userId);
            const verb = currentIsAdmin ? 'remove admin from' : 'grant admin to';
            if (!confirm(`Are you sure you want to ${verb} ${user?.email || userId}?`)) return;

            const result = await window.DrTroySupabase.adminAction('toggle_admin', {
                userId, makeAdmin: !currentIsAdmin
            });
            if (result.error) {
                showAdminToast('❌ ' + result.error, 'error');
            } else {
                const idx = _allUsers.findIndex(u => u.id === userId);
                if (idx >= 0) _allUsers[idx].is_admin = !currentIsAdmin;
                renderUsersTable(_allUsers);
                showAdminToast(`✅ Admin ${!currentIsAdmin ? 'granted' : 'removed'} for ${user?.email || userId}`, 'success');
            }
        }

        function showUDMStatus(message, type) {
            const el = document.getElementById('udm-status');
            if (!el) return;
            el.textContent = message;
            el.className = type === 'error' ? 'error-message' : type === 'success' ? 'success-message' : 'info-message';
            el.style.display = 'block';
            if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 4000);
        }

        function showAdminToast(message, type) {
            const div = document.createElement('div');
            div.textContent = message;
            div.className = 'admin-toast';
            div.style.cssText += type === 'error'
                ? 'background:#fee2e2;color:#991b1b;border:1px solid #f87171;'
                : 'background:#d1fae5;color:#065f46;border:1px solid #10b981;';
            document.body.appendChild(div);
            setTimeout(() => div.remove(), 4000);
        }

        function emailUser(email) {
            // Opens mailto — future: could open a compose modal
            window.location.href = 'mailto:' + email;
        }

        // ══════════════════════════════════════════════════════════════
        // COURSE MANAGEMENT — Real CRUD
        // ══════════════════════════════════════════════════════════════

        let _allCourseData = [];

        // Integration with Advanced Course Management System
        async function loadCourses() {
            if (window.CourseManagement && window.CourseManagement.loadCourses) {
                await window.CourseManagement.loadCourses();
            } else {
                // Fallback: wait for course management to load
                setTimeout(() => {
                    if (window.CourseManagement) {
                        window.CourseManagement.loadCourses();
                    }
                }, 100);
            }
        }

        async function refreshCourses() {
            if (window.CourseManagement && window.CourseManagement.refreshCourses) {
                window.CourseManagement.refreshCourses();
            }
        }

        // Maps Supabase course IDs → actual HTML file names
        const COURSE_FILE_MAP = {
            'core-balance-001':    'balance-gait-001',
            'core-mobility-001':   'mobility-fall-001',
            'core-joint-001':      'joint-replacement-001',
            'core-geriatric-001':  'geriatric-care-001',
            'core-tech-001':       'healthcare-technology-001',
            'core-infection-001':  'infection-control-001',
            'core-neuro-001':      'pt-neuro-001',
            'core-education-001':  'patient-education-001',
            'core-agents-001':     'physical-agents-001',
            'core-postsurg-001':   'post-surgical-001',
            'core-doc-001':        'documentation-001',
            'ot-adl-001':          'ot-adl-001',
            'pt-msk-001':          'pt-msk-001'
        };

        function renderCourseList(courses) {
            const container = document.getElementById('courseListContainer');
            if (!courses.length) { container.innerHTML = '<p style="color:#6b7280;text-align:center;grid-column:1/-1;">No courses found.</p>'; return; }
            container.innerHTML = courses.map(c => {
                const price = (parseInt(c.price_cents || 0) / 100).toFixed(2);
                const statusClass = c.is_active ? 'active' : 'draft';
                const statusLabel = c.is_active ? 'Active' : 'Inactive';
                const fileId = COURSE_FILE_MAP[c.id] || c.id;
                const courseUrl = `/courses/${fileId}-progressive.html`;
                return `<div class="course-card">
                    <div class="course-header"><h3>${esc(c.title)}</h3><div class="course-status ${statusClass}">${statusLabel}</div></div>
                    <div class="course-meta">
                        <div>ID: ${esc(c.id)}</div>
                        <div>CEU: ${c.ceu_hours} hrs · $${price}</div>
                        <div>Professions: ${(c.professions || []).join(', ') || 'All'}</div>
                    </div>
                    <div class="course-actions">
                        <a class="btn-small" href="${courseUrl}" target="_blank">👁️ View</a>
                        <button class="btn-small" onclick="editCourse('${esc(c.id)}')">✏️ Edit</button>
                        <button class="btn-small ${c.is_active ? 'danger' : ''}" onclick="toggleCourseActive('${esc(c.id)}', ${!c.is_active})">${c.is_active ? '⏸️ Deactivate' : '🚀 Activate'}</button>
                    </div>
                </div>`;
            }).join('');
        }

        function showAddCourseForm() {
            document.getElementById('courseModalTitle').textContent = '➕ Add New Course';
            document.getElementById('cf-id').value = '';
            document.getElementById('cf-slug').value = '';
            document.getElementById('cf-slug').disabled = false;
            document.getElementById('cf-title').value = '';
            document.getElementById('cf-description').value = '';
            document.getElementById('cf-ceu').value = '';
            document.getElementById('cf-price').value = '';
            document.getElementById('cf-professions').value = 'PT,PTA,OT,COTA';
            document.getElementById('cf-sort').value = '0';
            document.getElementById('cf-active').checked = true;
            document.getElementById('courseModalError').style.display = 'none';
            document.getElementById('courseModalSuccess').style.display = 'none';
            document.getElementById('courseModal').classList.add('active');
        }

        function editCourse(courseId) {
            const c = _allCourseData.find(x => x.id === courseId);
            if (!c) return;
            document.getElementById('courseModalTitle').textContent = '✏️ Edit Course';
            document.getElementById('cf-id').value = c.id;
            document.getElementById('cf-slug').value = c.id;
            document.getElementById('cf-slug').disabled = true;
            document.getElementById('cf-title').value = c.title || '';
            document.getElementById('cf-description').value = c.description || '';
            document.getElementById('cf-ceu').value = c.ceu_hours || '';
            document.getElementById('cf-price').value = c.price_cents || '';
            document.getElementById('cf-professions').value = (c.professions || []).join(',');
            document.getElementById('cf-sort').value = c.sort_order || 0;
            document.getElementById('cf-active').checked = c.is_active;
            document.getElementById('courseModalError').style.display = 'none';
            document.getElementById('courseModalSuccess').style.display = 'none';
            document.getElementById('courseModal').classList.add('active');
        }

        function closeCourseModal() { document.getElementById('courseModal').classList.remove('active'); }

        async function saveCourse() {
            const existingId = document.getElementById('cf-id').value;
            const slug = document.getElementById('cf-slug').value.trim();
            const profStr = document.getElementById('cf-professions').value.trim();
            const courseData = {
                title: document.getElementById('cf-title').value.trim(),
                description: document.getElementById('cf-description').value.trim(),
                ceu_hours: parseFloat(document.getElementById('cf-ceu').value),
                price_cents: parseInt(document.getElementById('cf-price').value),
                professions: profStr ? profStr.split(',').map(s => s.trim()) : [],
                sort_order: parseInt(document.getElementById('cf-sort').value) || 0,
                is_active: document.getElementById('cf-active').checked,
            };

            let result;
            if (existingId) {
                result = await SB.adminUpdateCourse(existingId, courseData);
            } else {
                courseData.id = slug;
                result = await SB.adminCreateCourse(courseData);
            }

            if (result.error) {
                const errEl = document.getElementById('courseModalError');
                errEl.textContent = '❌ ' + (result.error.message || result.error);
                errEl.style.display = 'block';
            } else {
                const sucEl = document.getElementById('courseModalSuccess');
                sucEl.textContent = existingId ? '✅ Course updated!' : '✅ Course created!';
                sucEl.style.display = 'block';
                setTimeout(() => closeCourseModal(), 1500);
                await refreshCourses();
            }
        }

        async function toggleCourseActive(courseId, makeActive) {
            const verb = makeActive ? 'activate' : 'deactivate';
            if (!confirm(`${verb.charAt(0).toUpperCase()+verb.slice(1)} this course?`)) return;
            const { error } = await SB.adminToggleCourseActive(courseId, makeActive);
            if (error) { showAdminToast('❌ ' + (error.message || error), 'error'); }
            else { showAdminToast(`✅ Course ${makeActive ? 'activated' : 'deactivated'}!`, 'success'); await refreshCourses(); }
        }

        // ══════════════════════════════════════════════════════════════
        // EMAIL CAMPAIGNS — Real Resend integration
        // ══════════════════════════════════════════════════════════════

        function loadEmailData() {
            // Ensure course dropdown is populated when switching to emails tab
            loadCampaignCourses();
        }

        function getCampaignFilters() {
            const filters = {};
            const prof = document.getElementById('campaign-profession')?.value;
            const st = document.getElementById('campaign-state')?.value?.trim();
            const cid = document.getElementById('campaign-course')?.value;
            if (prof) filters.profession = prof;
            if (st) filters.state = st;
            if (cid) filters.courseId = cid;
            return filters;
        }

        async function previewCampaignCount() {
            const el = document.getElementById('campaign-count');
            el.textContent = 'Counting…';
            const result = await SB.adminSendCampaign('', '', getCampaignFilters(), true);
            if (result.error) { el.textContent = '❌ ' + result.error; }
            else { el.textContent = `📬 ${result.count} recipient(s) match these filters`; }
        }

        async function sendCampaignEmail() {
            const subject = document.getElementById('campaign-subject').value.trim();
            const body = document.getElementById('campaign-body').value.trim();
            if (!subject || !body) { showAdminToast('Subject and body are required.', 'error'); return; }
            if (!confirm('Send this campaign to all matching users?')) return;

            const btn = document.getElementById('campaign-send-btn');
            btn.disabled = true; btn.textContent = '⏳ Sending…';
            const resultEl = document.getElementById('campaign-result');

            const htmlBody = body.includes('<') ? body : `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">${body.replace(/\n/g, '<br>')}</div>`;
            const result = await SB.adminSendCampaign(subject, htmlBody, getCampaignFilters());

            btn.disabled = false; btn.textContent = '🚀 Send Campaign';
            resultEl.style.display = 'block';
            if (result.error) {
                resultEl.style.color = '#dc2626';
                resultEl.textContent = '❌ ' + result.error;
            } else {
                resultEl.style.color = '#059669';
                resultEl.textContent = `✅ Sent to ${result.sent} user(s)${result.failed ? `, ${result.failed} failed` : ''}`;
            }
        }

        async function loadCampaignCourses() {
            const sel = document.getElementById('campaign-course');
            if (!sel) return;
            const { data } = await SB.adminGetAllCourses();
            if (data) {
                data.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.title;
                    sel.appendChild(opt);
                });
            }
        }

        // ══════════════════════════════════════════════════════════════
        // LICENSE TRACKING — Real data from Supabase
        // ══════════════════════════════════════════════════════════════

        async function loadLicenseData() {
            try {
                const result = await SB.adminAction('get_license_data', {});
                if (result.error) { showAdminToast('Failed to load license data: ' + result.error, 'error'); return; }
                const users = (result.data && result.data.profiles) || [];
            const today = new Date(); today.setHours(0,0,0,0);

            let expired = 0, within30 = 0, within90 = 0;
            users.forEach(u => {
                const exp = new Date(u.license_expiry_date);
                const days = Math.ceil((exp - today) / 86400000);
                if (days < 0) expired++;
                else if (days <= 30) within30++;
                else if (days <= 90) within90++;
            });

            document.getElementById('licExpired').textContent = expired;
            document.getElementById('licExpiring30').textContent = within30;
            document.getElementById('licExpiring90').textContent = within90;
            document.getElementById('licWithDate').textContent = users.length;

            const tbody = document.getElementById('licenseTableBody');
            if (!users.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#6b7280;">No license expiry dates set yet. Set them from User Detail modals.</td></tr>'; return; }

            tbody.innerHTML = users.map(u => {
                const exp = new Date(u.license_expiry_date);
                const days = Math.ceil((exp - today) / 86400000);
                let urgClass = 'safe', urgLabel = days + ' days';
                if (days < 0) { urgClass = 'urgent'; urgLabel = 'EXPIRED'; }
                else if (days <= 30) { urgClass = 'urgent'; urgLabel = days + ' days'; }
                else if (days <= 90) { urgClass = 'warning'; urgLabel = days + ' days'; }
                const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || '—';
                return `<tr>
                    <td>${esc(name)}</td>
                    <td>${esc(u.email)}</td>
                    <td>${esc(u.license_number || '—')}</td>
                    <td>${esc(u.license_state || '—')}</td>
                    <td>${esc(u.profession || '—')}</td>
                    <td>${exp.toLocaleDateString()}</td>
                    <td class="${urgClass}" style="font-weight:700;">${urgLabel}</td>
                    <td><button class="btn-small" onclick="viewUser('${u.id}')">👁️ View</button></td>
                </tr>`;
            }).join('');
            } catch(e) { showAdminToast('License data error: ' + e.message, 'error'); }
        }

        // ══════════════════════════════════════════════════════════════
        // PASSWORD RESET — via Netlify function
        // ══════════════════════════════════════════════════════════════

        async function sendPasswordReset() {
            if (!_currentViewedUser) return;
            if (!confirm(`Send password reset email to ${_currentViewedUser.email}?`)) return;
            showUDMStatus('Sending password reset…', 'info');
            const result = await SB.adminResetPassword(_currentViewedUser.email);
            if (result.error) { showUDMStatus('❌ ' + result.error, 'error'); }
            else { showUDMStatus(`✅ Password reset email sent to ${_currentViewedUser.email}`, 'success'); }
        }

        // ══════════════════════════════════════════════════════════════
        // LICENSE EXPIRY — save from user detail modal
        // ══════════════════════════════════════════════════════════════

        async function saveLicenseExpiry() {
            if (!_currentViewedUser) return;
            const dateVal = document.getElementById('udm-license-expiry').value;
            if (!dateVal) { showUDMStatus('Please select a date.', 'error'); return; }
            showUDMStatus('Saving…', 'info');
            const { error } = await SB.adminUpdateLicenseExpiry(_currentViewedUser.id, dateVal);
            if (error) { showUDMStatus('❌ ' + (error.message || error), 'error'); }
            else { showUDMStatus('✅ License expiry saved!', 'success'); }
        }

        // ══════════════════════════════════════════════════════════════
        // CERTIFICATE MANAGEMENT — in user detail modal
        // ══════════════════════════════════════════════════════════════

        async function loadUserCertificates(userId) {
            const container = document.getElementById('udm-certificates');
            container.innerHTML = '<p style="color:#6b7280;">Loading…</p>';

            const [certRes, compRes] = await Promise.all([
                SB.adminGetUserCertificates(userId),
                SB.adminGetUserCompletions(userId)
            ]);
            const certs = certRes.data || [];
            const completions = compRes.data || [];
            const certCourseIds = new Set(certs.map(c => c.course_id));

            let html = '';

            // Existing certs
            if (certs.length) {
                html += '<h5 style="color:#059669;margin-bottom:.5rem;">Issued Certificates</h5>';
                html += certs.map(c => `
                    <div class="enrollment-row">
                        <div>
                            <strong>${esc(c.certificate_number)}</strong>
                            <div style="font-size:.82rem;color:#6b7280;">${esc(c.course_id)} · Issued ${c.issued_at ? new Date(c.issued_at).toLocaleDateString() : '—'}${c.emailed_at ? ' · Emailed ✓' : ''}</div>
                        </div>
                        <button class="btn-small" onclick="reissueCertificate('${esc(c.user_id)}', '${esc(c.course_id)}')">🔄 Re-issue</button>
                    </div>`).join('');
            }

            // Completions without certs
            const uncertified = completions.filter(co => !certCourseIds.has(co.course_id));
            if (uncertified.length) {
                html += '<h5 style="color:#d69e2e;margin-top:1rem;margin-bottom:.5rem;">Completed — No Certificate Yet</h5>';
                html += uncertified.map(co => `
                    <div class="enrollment-row">
                        <div>
                            <strong>${esc(co.courses?.title || co.course_id)}</strong>
                            <div style="font-size:.82rem;color:#6b7280;">Score: ${co.quiz_score || '—'} · Completed ${co.completed_at ? new Date(co.completed_at).toLocaleDateString() : '—'}</div>
                        </div>
                        <button class="btn-small" onclick="issueCertificateForUser('${esc(co.user_id)}', '${esc(co.course_id)}', '${esc(co.id)}')">🏆 Issue Certificate</button>
                    </div>`).join('');
            }

            if (!html) html = '<p style="color:#6b7280;font-style:italic;">No completions or certificates.</p>';
            container.innerHTML = html;
        }

        async function issueCertificateForUser(userId, courseId, completionId) {
            if (!_currentViewedUser) return;
            showUDMStatus('Issuing certificate…', 'info');
            const course = _allCourseData.find(c => c.id === courseId);
            const result = await SB.adminIssueCertificate({
                userId, courseId, completionId,
                userEmail: _currentViewedUser.email,
                userName: [_currentViewedUser.first_name, _currentViewedUser.last_name].filter(Boolean).join(' '),
                courseTitle: course?.title || courseId,
                ceuHours: course?.ceu_hours || ''
            });
            if (result.error) { showUDMStatus('❌ ' + result.error, 'error'); }
            else {
                showUDMStatus(`✅ Certificate ${result.certNumber} issued!${result.emailSent ? ' Email sent.' : ''}`, 'success');
                await loadUserCertificates(userId);
            }
        }

        async function reissueCertificate(userId, courseId) {
            if (!confirm('Re-issue this certificate? A new certificate number will be generated and emailed.')) return;
            if (!_currentViewedUser) return;
            showUDMStatus('Re-issuing certificate…', 'info');
            const course = _allCourseData.find(c => c.id === courseId);
            const result = await SB.adminIssueCertificate({
                userId, courseId, reissue: true,
                userEmail: _currentViewedUser.email,
                userName: [_currentViewedUser.first_name, _currentViewedUser.last_name].filter(Boolean).join(' '),
                courseTitle: course?.title || courseId,
                ceuHours: course?.ceu_hours || ''
            });
            if (result.error) { showUDMStatus('❌ ' + result.error, 'error'); }
            else {
                showUDMStatus(`✅ Certificate re-issued: ${result.certNumber}${result.emailSent ? ' · Email sent.' : ''}`, 'success');
                await loadUserCertificates(userId);
            }
        }

        // Discount Code Functions — DB-backed

        let _allDiscountCodes = [];

        async function loadDiscountCodesFromDB() {
            try {
                const result = await SB.adminAction('get_discount_codes', {});
                if (result.error) { showAdminToast('Failed to load discount codes: ' + result.error, 'error'); return; }
                _allDiscountCodes = (result.data && result.data.codes) || [];
                renderDiscountCodesTable();
                updateDiscountCodeStats();
            } catch(e) { showAdminToast('Discount codes error: ' + e.message, 'error'); }
        }

        function updateDiscountCodeStats() {
            const codes = _allDiscountCodes;
            document.getElementById('totalCodes').textContent = codes.length;
            document.getElementById('activeCodes').textContent = codes.filter(c => c.is_active).length;
            document.getElementById('usedCodes').textContent = codes.reduce((s, c) => s + (c.current_uses || 0), 0);
            const savings = codes.reduce((s, c) => s + (c.current_uses || 0) * (c.discount_value || 0), 0);
            document.getElementById('totalSavings').textContent = '$' + savings.toLocaleString();
        }

        function renderDiscountCodesTable() {
            const tbody = document.getElementById('codesTableBody');
            if (!_allDiscountCodes.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#6b7280;">No discount codes yet.</td></tr>'; return; }
            tbody.innerHTML = _allDiscountCodes.map(c => {
                const discountLabel = c.discount_type === 'percentage' ? c.discount_value + '% Off' :
                                      c.discount_type === 'free' ? '100% Free' : '$' + c.discount_value + ' Off';
                const usage = (c.current_uses || 0) + '/' + (c.max_uses || '∞');
                const statusBadge = c.is_active ? '<span class="status-badge active">Active</span>' : '<span class="status-badge inactive">Inactive</span>';
                const window = (c.starts_at ? new Date(c.starts_at).toLocaleDateString() : '—') + ' → ' + (c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '∞');
                return `<tr>
                    <td><strong>${esc(c.code)}</strong></td>
                    <td>${esc(c.campaign_name || c.description || '—')}</td>
                    <td>${discountLabel}</td>
                    <td>${usage}</td>
                    <td>${window}</td>
                    <td>${c.new_customers_only ? '✓' : '—'}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn-small" onclick="toggleDiscountCode('${c.id}', ${!c.is_active})">${c.is_active ? '❌ Deactivate' : '✅ Activate'}</button>
                        <button class="btn-small danger" onclick="deleteDiscountCode('${c.id}')">🗑️</button>
                    </td>
                </tr>`;
            }).join('');
        }

        async function toggleDiscountCode(codeId, makeActive) {
            const result = await SB.adminAction('update_discount_code', { id: codeId, updates: { is_active: makeActive } });
            if (result.error) { showAdminToast('❌ ' + result.error, 'error'); return; }
            showAdminToast(`✅ Code ${makeActive ? 'activated' : 'deactivated'}`, 'success');
            await loadDiscountCodesFromDB();
        }

        async function deleteDiscountCode(codeId) {
            if (!confirm('Permanently delete this discount code?')) return;
            const result = await SB.adminAction('delete_discount_code', { id: codeId });
            if (result.error) { showAdminToast('❌ ' + result.error, 'error'); return; }
            showAdminToast('✅ Code deleted', 'success');
            await loadDiscountCodesFromDB();
        }


        function exportAllData() {
            alert('📥 All platform data would be exported.');
        }

        function importData() {
            alert('📤 Data import functionality would be implemented here.');
        }

        function runSystemDiagnostics() {
            alert('🔧 System diagnostics would run here.');
        }

        function optimizeDatabase() {
            alert('⚡ Database optimization would run here.');
        }

        function clearCache() {
            alert('🗑️ System cache would be cleared.');
        }

        function createBackup() {
            alert('💾 System backup would be created.');
        }

        function scheduleBackups() {
            alert('📅 Backup scheduling interface would open here.');
        }

        function restoreBackup() {
            alert('🔄 Backup restoration interface would open here.');
        }

        function factoryReset() {
            if (confirm('⚠️ Are you sure you want to perform a factory reset? This cannot be undone!')) {
                if (confirm('This will delete ALL data and reset the system. Are you absolutely sure?')) {
                    alert('⚠️ Factory reset would be performed here.');
                }
            }
        }

        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', async function() {
            console.log('📄 DOM loaded, starting main initialization...');
            
            try {
                // Only run if emergency functions aren't already working
                if (typeof window.switchMainTab === 'function') {
                    console.log('⚠️ Emergency mode detected - running minimal initialization');
                    try {
                        await initAdmin();
                        console.log('✅ InitAdmin completed');
                    } catch(initError) {
                        console.warn('InitAdmin failed but continuing with emergency mode:', initError);
                    }
                } else {
                    console.log('🚀 Running full initialization...');
                    await initAdmin();
                    console.log('✅ InitAdmin completed');
                }
                
                restoreSavedTab();
                console.log('✅ Saved tab restored');

                // Live search / filter for user table
                const userSearchEl = document.getElementById('userSearch');
                if (userSearchEl) {
                    userSearchEl.addEventListener('input', filterUsers);
                    console.log('✅ User search listener added');
                }
                
                const userFilterEl = document.getElementById('userFilter');
                if (userFilterEl) {
                    userFilterEl.addEventListener('change', filterUsers);
                    console.log('✅ User filter listener added');
                }

                // Update timestamps every minute
                setInterval(updateLastUpdate, 60000);
                console.log('✅ Update interval set');

                // Refresh Supabase data every 5 minutes
                setInterval(async () => {
                    try {
                        await updateDashboard();
                        await loadUsers();
                    } catch(e) {
                        console.warn('Periodic data update failed:', e);
                    }
                }, 300000);
                console.log('✅ Refresh interval set');
                
                console.log('🎉 Full initialization completed successfully');
            } catch (error) {
                console.error('💥 Critical error during page initialization:', error);
                // Still try to make basic functionality work
                try {
                    document.querySelector('.main-tab').classList.add('active');
                    document.getElementById('dashboard').classList.add('active');
                } catch(fallbackError) {
                    console.error('Even fallback failed:', fallbackError);
                }
            }
        });

        // ── CREDITS ──────────────────────────────────────────────────────
        let creditTargetUserId = null;

        function _sbClient() { return window.DrTroySupabase ? window.DrTroySupabase.getClient() : null; }

        async function lookupCreditUser() {
            const email = document.getElementById('creditUserEmail').value.trim();
            const resultEl = document.getElementById('creditUserResult');
            if (!email) return;
            resultEl.innerHTML = '<span style="color:#64748b;">Searching…</span>';
            creditTargetUserId = null;
            try {
                const userResult = await SB.adminAction('lookup_user', { email });
                if (userResult.error) { resultEl.innerHTML = '<span style="color:#dc2626;">' + esc(userResult.error) + '</span>'; return; }
                const data = userResult.data.user;
                creditTargetUserId = data.id;
                resultEl.innerHTML = `<span style="color:#059669;font-weight:600;">✓ Found: ${escapeHtml(data.first_name || '')} ${escapeHtml(data.last_name || '')} (${escapeHtml(data.profession || 'N/A')})</span>`;
                // Also load their current balance
                const credResult = await SB.adminAction('get_user_credits', { userId: data.id });
                const bal = (credResult.data && credResult.data.balance_cents) ? (credResult.data.balance_cents / 100).toFixed(2) : '0.00';
                resultEl.innerHTML += ` — Current balance: <strong>$${bal}</strong>`;
            } catch(e) { resultEl.innerHTML = '<span style="color:#dc2626;">Error looking up user.</span>'; }
        }

        async function grantCredits() {
            const btn = document.getElementById('grantCreditsBtn');
            const feedback = document.getElementById('grantCreditsFeedback');
            const amountDollars = parseFloat(document.getElementById('creditAmount').value);
            const description  = document.getElementById('creditDescription').value.trim();

            if (!creditTargetUserId) { feedback.innerHTML = '<span style="color:#dc2626;">Please find a user first.</span>'; return; }
            if (!amountDollars || amountDollars <= 0) { feedback.innerHTML = '<span style="color:#dc2626;">Enter a valid amount.</span>'; return; }

            btn.disabled = true;
            btn.textContent = 'Granting…';
            feedback.innerHTML = '';

            try {
                const amountCents = Math.round(amountDollars * 100);
                const result = await SB.adminAction('grant_credits', {
                    userId: creditTargetUserId,
                    amountCents: amountCents,
                    description: description || 'Admin credit grant',
                    adminId: _adminUser?.id || null
                });
                if (result.error) throw new Error(result.error);
                const newBal = result.data && result.data.new_balance_cents ? (result.data.new_balance_cents / 100).toFixed(2) : amountDollars.toFixed(2);
                feedback.innerHTML = `<span style="color:#059669;font-weight:600;">✓ $${amountDollars.toFixed(2)} credited. New balance: $${newBal}</span>`;
                document.getElementById('creditAmount').value = '';
                document.getElementById('creditDescription').value = '';
                document.getElementById('creditUserResult').innerHTML = `<span style="color:#059669;font-weight:600;">✓ User found — New balance: <strong>$${newBal}</strong></span>`;
            } catch(e) {
                feedback.innerHTML = `<span style="color:#dc2626;">Error: ${esc(e.message)}</span>`;
            }
            btn.disabled = false;
            btn.textContent = 'Grant Credits →';
        }

        async function loadUserBalance() {
            const email = document.getElementById('balanceUserEmail').value.trim();
            if (!email) return;
            const display = document.getElementById('balanceDisplay');
            display.style.display = 'none';
            try {
                const userResult = await SB.adminAction('lookup_user', { email });
                if (userResult.error) { alert('User not found: ' + userResult.error); return; }
                const profile = userResult.data.user;

                const credResult = await SB.adminAction('get_user_credits', { userId: profile.id });
                const creditData = credResult.data || {};
                const bal = creditData.balance_cents ? (creditData.balance_cents / 100).toFixed(2) : '0.00';
                document.getElementById('balanceAmount').textContent = '$' + bal;
                document.getElementById('balanceUserInfo').innerHTML = `<div style="font-weight:600;color:#1e293b;">${escapeHtml(profile.first_name||'')} ${escapeHtml(profile.last_name||'')}</div><div style="color:#64748b;font-size:.9rem;">${escapeHtml(email)} · ${escapeHtml(profile.profession||'')}</div>`;

                const txns = creditData.transactions || [];
                const typeLabels = { admin_grant: '🎁 Admin Grant', referral_earned: '👥 Referral', purchase_applied: '🛒 Applied to Purchase', adjustment: '⚙️ Adjustment' };
                const list = document.getElementById('transactionList');
                if (!txns.length) {
                    list.innerHTML = '<p style="color:#64748b;font-size:.9rem;text-align:center;padding:1rem;">No transactions yet.</p>';
                } else {
                    list.innerHTML = txns.map(t => `
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:.875rem 1rem;border-bottom:1px solid #f1f5f9;font-size:.9rem;">
                            <div>
                                <div style="font-weight:600;color:#1e293b;">${typeLabels[t.type] || t.type}</div>
                                <div style="color:#64748b;">${escapeHtml(t.description || '')} · ${new Date(t.created_at).toLocaleDateString()}</div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-weight:700;color:${t.amount_cents > 0 ? '#059669' : '#dc2626'};">${t.amount_cents > 0 ? '+' : ''}$${(t.amount_cents/100).toFixed(2)}</div>
                                <div style="color:#94a3b8;font-size:.8rem;">Bal: $${(t.balance_after_cents/100).toFixed(2)}</div>
                            </div>
                        </div>`).join('');
                }
                display.style.display = 'block';
            } catch(e) { alert('Error loading balance: ' + e.message); }
        }

