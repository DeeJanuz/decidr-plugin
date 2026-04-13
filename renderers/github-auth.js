(function() {
  'use strict';
  window.__renderers = window.__renderers || {};

  window.__renderers.decidr_github_auth = function(container, data, meta) {
    container.innerHTML = '';

    window.__decidrAPI.withReady(container, meta, function() {
      var API = window.__decidrAPI;

      var html = '';
      html += '<div style="max-width:420px;margin:0 auto;padding:var(--space-6);">';

      // Header
      html += '<div style="text-align:center;margin-bottom:var(--space-6);">';
      html += '<svg width="40" height="40" viewBox="0 0 16 16" fill="none" style="margin-bottom:var(--space-3);">';
      html += '<path fill-rule="evenodd" clip-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" fill="currentColor"/>';
      html += '</svg>';
      html += '<h2 style="margin:0;font-size:var(--text-h2);color:var(--text-primary);">Connect GitHub PAT</h2>';
      html += '<p style="margin:var(--space-2) 0 0;color:var(--text-secondary);font-size:var(--text-small);">';
      html += 'Enter your GitHub username and a Personal Access Token for outbound GitHub write actions. Repository sync itself is managed automatically through Ludflow.</p>';
      html += '</div>';

      // Form
      html += '<div id="decidr-gh-form">';

      // Username field
      html += '<div style="margin-bottom:var(--space-4);">';
      html += '<label style="display:block;font-size:var(--text-small);color:var(--text-secondary);margin-bottom:var(--space-1);">GitHub Username</label>';
      html += '<input type="text" id="decidr-gh-username" value="' + ((data && data.github_username) || '') + '" placeholder="octocat" style="';
      html += 'width:100%;box-sizing:border-box;padding:var(--space-2) var(--space-3);';
      html += 'background:var(--glass-bg);border:1px solid var(--border-default);border-radius:var(--border-radius-md);';
      html += 'color:var(--text-primary);font-size:var(--text-body);outline:none;';
      html += '" />';
      html += '</div>';

      // Token field
      html += '<div style="margin-bottom:var(--space-4);">';
      html += '<label style="display:block;font-size:var(--text-small);color:var(--text-secondary);margin-bottom:var(--space-1);">Personal Access Token</label>';
      html += '<input type="password" id="decidr-gh-token" placeholder="github_pat_..." style="';
      html += 'width:100%;box-sizing:border-box;padding:var(--space-2) var(--space-3);';
      html += 'background:var(--glass-bg);border:1px solid var(--border-default);border-radius:var(--border-radius-md);';
      html += 'color:var(--text-primary);font-size:var(--text-body);outline:none;font-family:monospace;';
      html += '" />';
      html += '<p style="margin:var(--space-1) 0 0;font-size:var(--text-xs);color:var(--text-tertiary);">';
      html += 'Create at GitHub &rarr; Settings &rarr; Developer settings &rarr; Personal access tokens. ';
      html += 'Your PAT is sent directly to DecidR and encrypted &mdash; it never passes through the AI agent. ';
      html += 'This PAT is used for outbound actions like creating issues, opening PRs, reviews, and merges. ';
      html += 'Note: you must be signed in to DecidR in this companion first for the PAT to be saved.</p>';
      html += '</div>';

      // Status message area
      html += '<div id="decidr-gh-status" style="margin-bottom:var(--space-4);display:none;"></div>';

      // Submit button
      html += '<button id="decidr-gh-submit" style="';
      html += 'width:100%;padding:var(--space-2) var(--space-4);';
      html += 'background:var(--accent-primary);color:#fff;border:none;border-radius:var(--border-radius-md);';
      html += 'font-size:var(--text-body);font-weight:var(--weight-medium);cursor:pointer;';
      html += 'transition:background 0.15s ease;';
      html += '">Save GitHub PAT</button>';

      html += '</div>'; // form
      html += '</div>'; // wrapper

      container.innerHTML = html;

      // --- Wire events ---

      var submitBtn = container.querySelector('#decidr-gh-submit');
      var statusEl = container.querySelector('#decidr-gh-status');
      var usernameInput = container.querySelector('#decidr-gh-username');
      var tokenInput = container.querySelector('#decidr-gh-token');

      function showStatus(message, variant) {
        statusEl.style.display = 'block';
        statusEl.style.padding = 'var(--space-3)';
        statusEl.style.borderRadius = 'var(--border-radius-md)';
        statusEl.style.fontSize = 'var(--text-small)';
        statusEl.style.lineHeight = '1.4';
        if (variant === 'error') {
          statusEl.style.background = 'rgba(239,68,68,0.1)';
          statusEl.style.border = '1px solid rgba(239,68,68,0.3)';
          statusEl.style.color = '#f87171';
        } else if (variant === 'warning') {
          statusEl.style.background = 'rgba(245,158,11,0.1)';
          statusEl.style.border = '1px solid rgba(245,158,11,0.3)';
          statusEl.style.color = '#fbbf24';
        } else {
          statusEl.style.background = 'rgba(34,197,94,0.1)';
          statusEl.style.border = '1px solid rgba(34,197,94,0.3)';
          statusEl.style.color = '#4ade80';
        }
        // Allow simple HTML (for line breaks / emphasis) in status messages
        statusEl.innerHTML = message;
      }

      function resetSubmitButton() {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save GitHub PAT';
        submitBtn.style.opacity = '1';
      }

      function describeError(err) {
        var status = err && err.status;
        var detail = (err && (err.bodyMessage || err.message)) || 'Unknown error';
        if (status === 401) {
          return {
            variant: 'warning',
            html: '<strong>Not signed in to DecidR.</strong><br>'
              + 'Your PAT was not rejected &mdash; the companion could not authenticate to DecidR at all. '
              + 'Complete the DecidR plugin sign-in (Ludflow OAuth) in MCPViews, then try again.'
          };
        }
        if (status === 403) {
          return {
            variant: 'warning',
            html: '<strong>No access to this DecidR organization.</strong><br>'
              + 'You are signed in, but the active organization does not list you as a member. '
              + 'Switch orgs in the companion or ask an admin to add you, then try again.'
          };
        }
        if (status === 400 || status === 422) {
          return {
            variant: 'error',
            html: '<strong>Invalid request.</strong><br>' + detail
          };
        }
        if (status >= 500) {
          return {
            variant: 'error',
            html: '<strong>DecidR server error (' + status + ').</strong><br>' + detail
          };
        }
        if (!status) {
          return {
            variant: 'error',
            html: '<strong>Could not reach DecidR.</strong><br>'
              + 'Check your connection, then try again. (' + detail + ')'
          };
        }
        return {
          variant: 'error',
          html: '<strong>Failed to connect (' + status + ').</strong><br>' + detail
        };
      }

      submitBtn.addEventListener('click', function() {
        var username = usernameInput.value.trim();
        var token = tokenInput.value.trim();

        if (!username) { showStatus('Please enter your GitHub username.', 'error'); return; }
        if (!token) { showStatus('Please enter your Personal Access Token.', 'error'); return; }

        // Preflight: if we have no DecidR session token, the POST will 401 and
        // look like a bad PAT. Tell the user the real problem instead.
        if (typeof API.hasToken === 'function' ? !API.hasToken() : !API._hasToken) {
          showStatus(
            '<strong>Not signed in to DecidR yet.</strong><br>'
              + 'The companion has no DecidR session, so your PAT cannot be saved. '
              + 'Complete the DecidR plugin sign-in (Ludflow OAuth) in MCPViews, then reopen this form.',
            'warning'
          );
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Connecting...';
        submitBtn.style.opacity = '0.6';
        statusEl.style.display = 'none';

        API.post('/github/connections', {
          githubUsername: username,
          accessToken: token
        }).then(function() {
          showStatus('GitHub PAT saved successfully for outbound write actions. You can close this panel.', 'success');
          submitBtn.textContent = 'Saved';
          submitBtn.style.background = 'rgba(34,197,94,0.8)';
          tokenInput.value = '';
        }).catch(function(err) {
          console.error('[decidr] github-auth submit failed', err);
          var desc = describeError(err);
          showStatus(desc.html, desc.variant);
          resetSubmitButton();
        });
      });

      // Hover effect
      submitBtn.addEventListener('mouseenter', function() {
        if (!submitBtn.disabled) submitBtn.style.background = 'var(--accent-primary-hover)';
      });
      submitBtn.addEventListener('mouseleave', function() {
        if (!submitBtn.disabled) submitBtn.style.background = 'var(--accent-primary)';
      });
    });
  };
})();
