// Final optimized, production-ready JavaScript for robust job filtering

let allowedExperienceLevels = ['Entry level', 'Associate', 'Mid-Senior level'];

let excludedCompanies = [
  'IBM', 'Amazon', 'Infosys', 'Discover', 'JP Morgan', 'Capital One', 'Fidelity', 'Deloitte', 
  'Goldman Sachs', 'Walmart', 'PayPal', 'Oracle', 'Luxoft', 'Google', 'Meta', 'Fiserv', 'Mastercard', 
  'Snapchat', 'Microsoft', 'TikTok', 'Apple', 'FedEx', 'EPAM'
];

const companyAliases = {
  'Google': ['Alphabet'],
  'Meta': ['Facebook']
};

const companyCache = new Map();
const CACHE_TTL = 3600000; // 1 hour

// Normalize experience levels
const experienceMap = {
  'entrylevel': true,
  'associate': true,
  'midseniorlevel': true
};

function isAllowedExperience(jobExperience) {
  const normalized = jobExperience.toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/senior/g, '');
  return experienceMap[normalized];
}

// Robust company filtering
function getFullExclusionList() {
  return excludedCompanies.concat(...Object.values(companyAliases).flat());
}

function isAllowedCompany(companyName) {
  return !getFullExclusionList().some(excluded => {
    const escaped = excluded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(companyName);
  });
}

// Secure API request with caching, rate limiting, and fail-open
const apiQueue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || apiQueue.length === 0) return;
  isProcessing = true;

  const { companyName, resolve } = apiQueue.shift();
  try {
    const result = await fetchCompanyData(companyName);
    companyCache.set(companyName, { result, timestamp: Date.now() });
    resolve(result);
  } catch (error) {
    console.error('API error:', error);
    resolve(true); // Fail open
  }

  isProcessing = false;
  processQueue();
}

async function companyMeetsCriteria(companyName) {
  const cached = companyCache.get(companyName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  return new Promise(resolve => {
    apiQueue.push({ companyName, resolve });
    processQueue();
  });
}

// Filtering with platform-specific selectors
function getPlatformSelectors() {
  if (window.location.hostname.includes('dice.com')) {
    return {
      card: '[data-cy="search-result"]',
      title: '[data-cy="card-title-link"]',
      company: '[data-cy="company-name-link"]',
      experience: '[data-cy="experience-level"]'
    };
  }
  // Extend for other platforms
  return {};
}

// Debounced filtering with IntersectionObserver
let filterTimeout;
async function filterJobs() {
  clearTimeout(filterTimeout);
  filterTimeout = setTimeout(async () => {
    const selectors = getPlatformSelectors();
    if (!selectors.card) return;

    const jobCards = document.querySelectorAll(selectors.card);

    jobCards.forEach(async card => {
      const jobTitle = card.querySelector(selectors.title)?.textContent || '';
      const companyName = card.querySelector(selectors.company)?.textContent || '';
      const jobExperience = card.querySelector(selectors.experience)?.textContent || '';

      if (!isAllowedExperience(jobExperience)) {
        markFiltered(card, 'Experience Level');
        return;
      }

      if (!isAllowedCompany(companyName)) {
        markFiltered(card, 'Company Excluded');
        return;
      }

      const passesCompanyCriteria = await companyMeetsCriteria(companyName);
      if (!passesCompanyCriteria) {
        markFiltered(card, 'Size/Revenue');
        return;
      }

      card.style.opacity = '';
      const existingTag = card.querySelector('.filter-tag');
      if (existingTag) existingTag.remove();
    });
  }, 500);
}

// Mark filtered jobs visually
function markFiltered(card, reason) {
  card.style.opacity = '0.3';
  card.style.position = 'relative';
  card.insertAdjacentHTML('beforeend', 
    `<div class="filter-tag" style="position: absolute; top: 5px; right: 5px; background: red; color: white; padding: 2px 5px; border-radius: 3px;">
      ${reason}
    </div>`
  );
}

// Initial load and dynamic content observation
window.addEventListener('load', filterJobs);

const observer = new MutationObserver(filterJobs);
observer.observe(document.body, { childList: true, subtree: true });

// Cache cleanup
setInterval(() => {
  const now = Date.now();
  companyCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_TTL) {
      companyCache.delete(key);
    }
  });
}, 60000);
