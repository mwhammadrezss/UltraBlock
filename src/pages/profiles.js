/**
 * ══════════════════════════════════════════════════════════════
 *  UltraBlock — Multi-Profile Controller
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

(function() {
  const PROFILES_KEY = 'ub_profiles';
  const ACTIVE_PROFILE_KEY = 'ub_active_profile';

  const DEFAULT_PROFILES = [
    {
      id: 'default',
      name: 'Standard',
      icon: '🛡️',
      description: 'Balanced ad blocking with tracker poisoning',
      rules: {
        ads: true, trackers: true, malware: true, annoyances: true,
        cookieNeg: true, darkPatterns: true, trackerPoison: true,
        dopamineDetox: false, retroMode: false,
        socialBlock: false, adultBlock: false, gamingBlock: false
      }
    },
    {
      id: 'strict',
      name: 'Maximum Security',
      icon: '🔒',
      description: 'Block everything suspicious, maximum privacy',
      rules: {
        ads: true, trackers: true, malware: true, annoyances: true,
        cookieNeg: true, darkPatterns: true, trackerPoison: true,
        dopamineDetox: true, retroMode: false,
        socialBlock: true, adultBlock: false, gamingBlock: false,
        no3pScripts: true, no3pFrames: true, noFonts: true, noWebRTC: true
      }
    },
    {
      id: 'kids',
      name: 'Kids Safe',
      icon: '👶',
      description: 'Block ads, adult content, social media, and gaming sites',
      rules: {
        ads: true, trackers: true, malware: true, annoyances: true,
        cookieNeg: true, darkPatterns: true, trackerPoison: false,
        dopamineDetox: true, retroMode: false,
        socialBlock: true, adultBlock: true, gamingBlock: true
      }
    },
    {
      id: 'work',
      name: 'Work Focus',
      icon: '💼',
      description: 'Block ads + social media + entertainment distractions',
      rules: {
        ads: true, trackers: true, malware: true, annoyances: true,
        cookieNeg: true, darkPatterns: true, trackerPoison: false,
        dopamineDetox: true, retroMode: false,
        socialBlock: true, adultBlock: false, gamingBlock: true
      }
    }
  ];

  const RULE_LABELS = {
    ads: 'Ads', trackers: 'Trackers', malware: 'Malware', annoyances: 'Annoyances',
    cookieNeg: 'Cookie Shield', darkPatterns: 'Dark Patterns', trackerPoison: 'Tracker Poison',
    dopamineDetox: 'Dopamine Detox', retroMode: 'Retro Mode',
    socialBlock: 'Social Media', adultBlock: 'Adult Content', gamingBlock: 'Gaming',
    no3pScripts: 'No 3P Scripts', no3pFrames: 'No 3P Frames',
    noFonts: 'No Fonts', noWebRTC: 'No WebRTC'
  };

  let profiles = [];
  let activeProfileId = 'default';

  function init() {
    chrome.storage.local.get([PROFILES_KEY, ACTIVE_PROFILE_KEY], result => {
      profiles = result[PROFILES_KEY] || DEFAULT_PROFILES;
      activeProfileId = result[ACTIVE_PROFILE_KEY] || 'default';
      render();
    });
  }

  function render() {
    const grid = document.getElementById('profiles-grid');
    grid.innerHTML = '';

    for (const profile of profiles) {
      const card = document.createElement('div');
      card.className = 'profile-card' + (profile.id === activeProfileId ? ' active' : '');
      card.innerHTML = `
        <div class="profile-icon">${profile.icon}</div>
        <div class="profile-name">${profile.name}</div>
        <div class="profile-desc">${profile.description}</div>
        <div class="profile-rules">
          ${Object.entries(profile.rules || {}).map(([key, val]) =>
            `<span class="rule-chip ${val ? 'on' : 'off'}">${RULE_LABELS[key] || key}</span>`
          ).join('')}
        </div>
      `;
      card.addEventListener('click', () => activateProfile(profile.id));
      grid.appendChild(card);
    }

    // Add profile button
    const addBtn = document.createElement('div');
    addBtn.className = 'add-profile';
    addBtn.innerHTML = '<div class="icon">➕</div><div class="label">Create New Profile</div>';
    addBtn.addEventListener('click', showCreateForm);
    grid.appendChild(addBtn);
  }

  function activateProfile(id) {
    activeProfileId = id;
    chrome.storage.local.set({ [ACTIVE_PROFILE_KEY]: id }, () => {
      const profile = profiles.find(p => p.id === id);
      if (profile) {
        chrome.runtime.sendMessage({
          action: 'switchProfile',
          profileId: id,
          rules: profile.rules
        });
      }
      render();
    });
  }

  function showCreateForm() {
    document.getElementById('create-form').style.display = 'block';
  }

  document.getElementById('btn-cancel-create').addEventListener('click', () => {
    document.getElementById('create-form').style.display = 'none';
  });

  document.getElementById('btn-create').addEventListener('click', () => {
    const name = document.getElementById('new-name').value.trim();
    const icon = document.getElementById('new-icon').value.trim() || '🛡️';
    const template = document.getElementById('new-template').value;

    if (!name) return;

    const base = profiles.find(p => p.id === template) || profiles[0];
    const newProfile = {
      id: 'profile_' + Date.now(),
      name: name,
      icon: icon,
      description: `Custom profile based on ${base.name}`,
      rules: { ...base.rules }
    };

    profiles.push(newProfile);
    chrome.storage.local.set({ [PROFILES_KEY]: profiles }, () => {
      document.getElementById('create-form').style.display = 'none';
      document.getElementById('new-name').value = '';
      render();
    });
  });

  init();
})();
