/* ========================================
   Google Auth Module
   Handles OAuth 2.0 via Google Identity Services
   ======================================== */

const GoogleAuth = {
    tokenClient: null,
    accessToken: null,

    // Scopes for Fitness (read) and Calendar (read events)
    SCOPES: 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/calendar.events.readonly',

    init(callback) {
        const clientId = localStorage.getItem('lifeos-google-client-id');
        if (!clientId) {
            console.log("No Google Client ID found.");
            if (callback) callback(false);
            return;
        }

        // Check if script is already present
        if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
            this.initClient(clientId, callback);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => this.initClient(clientId, callback);
        document.body.appendChild(script);
    },

    initClient(clientId, callback) {
        try {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: this.SCOPES,
                callback: (resp) => {
                    if (resp.error !== undefined) {
                        throw (resp);
                    }
                    this.handleResponse(resp);
                    // Notify caller that sign-in completed
                    window.dispatchEvent(new CustomEvent('google-auth-changed', { detail: { signedIn: true } }));
                },
            });

            this.checkToken();
            if (callback) callback(this.isSignedIn());
        } catch (e) {
            console.error("Error initializing Google Auth:", e);
        }
    },

    signIn() {
        if (!this.tokenClient) {
            // Try re-init if client ID exists now
            const clientId = localStorage.getItem('lifeos-google-client-id');
            if (clientId) {
                this.init((ready) => {
                    if (ready && this.tokenClient) this.tokenClient.requestAccessToken({ prompt: 'consent' });
                });
            } else {
                alert("Please save your Google Client ID in Settings first.");
            }
            return;
        }

        if (this.isSignedIn()) return;

        // Skip consent if possible, otherwise 'consent'
        this.tokenClient.requestAccessToken({ prompt: '' });
    },

    signOut() {
        const token = this.accessToken;
        if (token) {
            if (typeof google !== 'undefined') {
                google.accounts.oauth2.revoke(token, () => { console.log('Revoked'); });
            }
        }
        this.accessToken = null;
        localStorage.removeItem('lifeos-google-token');
        localStorage.removeItem('lifeos-google-expiry');
        window.dispatchEvent(new CustomEvent('google-auth-changed', { detail: { signedIn: false } }));
    },

    handleResponse(resp) {
        this.accessToken = resp.access_token;
        const expiresIn = parseInt(resp.expires_in);
        const expiry = Date.now() + (expiresIn * 1000);

        localStorage.setItem('lifeos-google-token', this.accessToken);
        localStorage.setItem('lifeos-google-expiry', expiry);
    },

    checkToken() {
        const token = localStorage.getItem('lifeos-google-token');
        const expiry = parseInt(localStorage.getItem('lifeos-google-expiry'));

        if (token && expiry && Date.now() < expiry) {
            this.accessToken = token;
        } else {
            this.accessToken = null;
            // Don't auto-remove from storage to allow re-validation if needed, 
            // but effectively we are signed out.
            // Actually better to clear if expired.
            if (token) {
                // Token existed but expired
                localStorage.removeItem('lifeos-google-token');
                localStorage.removeItem('lifeos-google-expiry');
            }
        }
    },

    isSignedIn() {
        this.checkToken();
        return !!this.accessToken;
    },

    getToken() {
        this.checkToken();
        return this.accessToken;
    }
};
