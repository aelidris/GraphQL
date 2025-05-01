// DOM elements
const loginPage = document.getElementById('login-page');
const profilePage = document.getElementById('profile-page');
const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const logoutBtn = document.getElementById('logout-btn');

// User info elements
const userInitial = document.getElementById('user-initial');
const userName = document.getElementById('user-name');
const userFullName = document.getElementById('user-fullName')
const userEmail = document.getElementById('user-email')
const totalXp = document.getElementById('total-xp');
const transactionsCount = document.getElementById('transactions-count');
const auditRatio = document.getElementById('pass-ratio');
const userLevel = document.getElementById('user-level')
const recentPassedProjects = document.getElementById('projects-list');

// Graph elements
const xpTimeGraph = document.getElementById('xp-time-graph');
const skillsChart = document.getElementById('skill-graph');
const tooltip = document.getElementById('tooltip');


// Tab management
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabId = button.getAttribute('data-tab');
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
    });
});

let authToken = '';
const API_URL = 'https://learn.zone01oujda.ma/api';
const GRAPHQL_ENDPOINT = `${API_URL}/graphql-engine/v1/graphql`;

// Check if user is already logged in
function checkAuth() {
    const token = localStorage.getItem('authToken');
    if (token) {
        authToken = token;
        showProfilePage();
        loadUserData();
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    await login(username, password);
});

logoutBtn.addEventListener('click', () => {
    logout();
});

async function login(username, password) {
    const credentials = btoa(`${username}:${password}`);
    const response = await fetch(`${API_URL}/auth/signin`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`
        }
    });
    if (!response.ok) {
        errorMessage.style.display = 'block';
        return;
    }
    const token = await response.json();
    authToken = token;
    localStorage.setItem('authToken', token);
    errorMessage.style.display = 'none';
    showProfilePage();
    await loadUserData();
}

function logout() {
    localStorage.removeItem('authToken');
    authToken = '';
    showLoginPage();
    return;
}

function showProfilePage() {
    loginPage.classList.add('hidden');
    profilePage.classList.remove('hidden');
}

function showLoginPage() {
    profilePage.classList.add('hidden');
    loginPage.classList.remove('hidden');
}

async function executeGraphQLQuery(query) {
    try {
        const response = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                query
            })
        });
        const data = await response.json();

        if (data.errors) {
            throw data.errors[0].message;
        }

        return data.data;

    } catch (error) {
        if (typeof error === 'string' && /JWT|Unauthorized|Invalid.*token|Token.*expired|Auth|Access.*denied/i.test(error)) {
            logout();
        }
    }
}

async function loadUserData() {
    await loadBasicUserInfo();
    await loadXpAndProjects();
    await loadSkillsChart();
}

async function loadBasicUserInfo() {
    const userInfo = `
        {
            user {
                login
                firstName
                lastName
                email
            }
        }
    `;

    const data = await executeGraphQLQuery(userInfo);
    const user = data.user[0];
    await loadUserPicture(data, user.login);
    userFullName.textContent = `${user.firstName} ${user.lastName}`;
    userName.textContent = user.login;
    userEmail.textContent = `${user.email}`
}

async function loadUserPicture(data, username) {
    const profile = {};
    profile.user = data;
    const login = usersPicID.get(username)
    const imgID = login ? `3P3A${login}.JPG` : `${username}.jpg`
    const image = document.createElement('img');
    image.src = `https://discord.zone01oujda.ma/assets/pictures/${imgID}?format=webp&width=250&height=250`

    image.onerror = function () {
        userInitial.innerHTML = '';
        userInitial.textContent = `${username.charAt(0)}`;
    }

    image.addEventListener('click', () => {
        window.open(image.src, '_blank');
    });
    userInitial.innerHTML = '';
    userInitial.appendChild(image);
}

async function loadXpAndProjects() {
    const totalXPrecentProjects = `
               {
                  user {
                    auditRatio
                    transactions(
                      where: {
                        type: { _eq: "xp" }
                        _and: [
                          { path: { _niregex: "piscine-go" } }
                          { path: { _niregex: "piscine-js/" } }
                        ]
                      }
                    ) {
                      amount
                      path
                      createdAt
                    }
                  }
                }
            `;

    const data = await executeGraphQLQuery(totalXPrecentProjects);
    const user = data.user[0];
    const transactions = user.transactions

    createXpTimeChart(transactions);

    // Calculate total XP
    const totalXpAmount = user.transactions.reduce((sum, tx) => sum + tx.amount, 0);
    if ((totalXpAmount / 1000).toFixed(0) >= 1000) {
        totalXp.textContent = ((totalXpAmount / 1000) / 1000).toFixed(2) + ' MB'
    } else (
        totalXp.textContent = (totalXpAmount / 1000).toFixed(0) + ' kB'
    )

    let projects = user.transactions.filter(r => {
        if (!r.path) return false;
        return !r.path.toLowerCase().includes("checkpoint");
    }).slice(-3).reverse();
    transactionsCount.textContent = user.transactions.length;
    auditRatio.textContent = `${(user.auditRatio).toFixed(1)}`;

    const lvlQuery = `
            {
                user {
                  transactions(
                    where: {
                      type: { _eq: "level" }
                      _and: [
                        { path: { _niregex: "piscine-go" } }
                        { path: { _niregex: "piscine-js" } }
                      ]
                    }
                    
                  ) {
                    amount
                    createdAt
                  }
                }
            }`;

    const levelData = await executeGraphQLQuery(lvlQuery);
    const tr = levelData.user[0].transactions;
    const lastLevel = tr[tr.length - 1].amount;
    userLevel.textContent = `${lastLevel}`;
    
    if (projects.length > 0) {
        recentPassedProjects.innerHTML = '';
        projects.forEach(project => {
            const pathParts = project.path.split('/').filter(Boolean);
            const projectName = pathParts[pathParts.length - 1] || "Unknown Project";
            const listItem = document.createElement('li');
            listItem.className = 'project-item pass';
            listItem.innerHTML = `
                <div>${projectName} (${(project.amount / 1000).toFixed(2)} kB)</div>
            `;
            recentPassedProjects.appendChild(listItem);
        });
    } else {
        recentPassedProjects.innerHTML = '<li class="project-item">No passed projects found.</li>';
    }
}

function createXpTimeChart(transactions) {
    xpTimeGraph.innerHTML = '';
    if (!transactions || transactions.length === 0) {
        xpTimeGraph.innerHTML = '<text x="50%" y="50%" text-anchor="middle">No XP data available</text>';
        return;
    }
    let cumulativeXp = 0;

    const data = transactions.map(tx => {
        cumulativeXp += tx.amount;
        return {
            date: new Date(tx.createdAt),
            xp: cumulativeXp,
            amount: tx.amount,
            path: tx.path
        };
    });
    
    const width = 800;
    const height = 400;
    const margin = { top: 40, right: 40, bottom: 60, left: 80 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const dateMin = data[0].date;
    const dateMax = data[data.length - 1].date;
    const xpMax = data[data.length - 1].xp;
    
    const xScale = (date) => {
        return margin.left + ((date - dateMin) / (dateMax - dateMin)) * chartWidth;
    };

    const yScale = (y) => {
        return height - margin.bottom - (y / xpMax) * chartHeight;
    };

    let svg = `
        <!-- Axes -->
        <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" class="axis-line" />
        <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" class="axis-line" />
        
        <!-- Labels -->
        <text x="${margin.left + chartWidth / 2}" y="${height - 15}" text-anchor="middle">Timeline</text>
        <text transform="translate(13, ${margin.top + chartHeight / 2}) rotate(-90)" text-anchor="middle">Cumulative XP</text>
        <text x="${margin.left + chartWidth / 2}" y="${margin.top - 10}" text-anchor="middle" font-weight="bold">XP Progress Over Time</text>
    `;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const tickCount = Math.min(8, data.length);
    const dateRange = dateMax - dateMin;

    for (let i = 0; i < tickCount; i++) {
        const tickDate = new Date(dateMin.getTime() + (dateRange * i / (tickCount - 1)));
        const tickX = xScale(tickDate);

        svg += `
            <line x1="${tickX}" y1="${height - margin.bottom}" x2="${tickX}" y2="${height - margin.bottom + 5}" stroke="#666" />
            <text x="${tickX}" y="${height - margin.bottom + 20}" text-anchor="middle" class="axis-text">
                ${monthNames[tickDate.getMonth()]} ${tickDate.getFullYear()}
            </text>
        `;
    }

    const yTickCount = 5;
    for (let i = 0; i <= yTickCount; i++) {
        const tickValue = (xpMax / yTickCount) * i;
        const tickY = yScale(tickValue);

        svg += `
            <line x1="${margin.left - 5}" y1="${tickY}" x2="${margin.left}" y2="${tickY}" stroke="#666" />
            <line x1="${margin.left}" y1="${tickY}" x2="${width - margin.right}" y2="${tickY}" stroke="#eee" stroke-dasharray="3,3" />
            <text x="${margin.left - 10}" y="${tickY + 5}" text-anchor="end" class="axis-text">
                ${Math.round(tickValue).toLocaleString()}
            </text>
        `;
    }

    let pathD = `M ${xScale(data[0].date)} ${yScale(data[0].xp)}`;
    for (let i = 1; i < data.length; i++) {
        pathD += ` L ${xScale(data[i].date)} ${yScale(data[i].xp)}`;
    }

    svg += `<path d="${pathD}" fill="none" stroke="var(--primary-color)" stroke-width="3" />`;

    const points = data.map((d, i) => {
        if (i === 0 || i === data.length - 1 || d.amount >= 1000) {
            const pathParts = d.path.split('/').filter(Boolean);
            const projectName = pathParts[pathParts.length - 1] || "XP Gain";

            return `<circle 
                cx="${xScale(d.date)}" 
                cy="${yScale(d.xp)}" 
                r="5" 
                fill="var(--secondary-color)"
                onmouseover="showTooltip(event, '${projectName}', '${d.date.toLocaleDateString()}', ${d.amount}, ${d.xp})"
                onmouseout="hideTooltip()"
            />`;
        }
        return '';
    }).join('');

    svg += points;

    xpTimeGraph.innerHTML = svg;
}

function showTooltip(event, projectName, date, amount, totalXp) {
    const circle = event.target;
    circle.setAttribute('r', '7');

    tooltip.style.opacity = 1;
    tooltip.style.left = `${event.pageX + 10}px`;
    tooltip.style.top = `${event.pageY - 30}px`;
    tooltip.innerHTML = `
        <strong>${projectName}</strong><br>
        Date: ${date}<br>
        XP: ${(amount / 1000).toFixed(2).toLocaleString() + ' kB'}<br>
        Total: ${(totalXp / 1000).toFixed(2).toLocaleString() + ' kB'}
    `;
}

function hideTooltip() {
    const circles = document.querySelectorAll('circle');
    circles.forEach(circle => circle.setAttribute('r', '5'));
    tooltip.style.opacity = 0;
}

async function loadSkillsChart() {
    const skillsData = `{
                user {
                    transactions(
                        where: { type: { _in: [
                            "skill_go", "skill_js", "skill_algo", "skill_html", "skill_css",
                            "skill_docker", "skill_prog", "skill_stats", "skill_tcp", "skill_unix",
                            "skill_sql", "skill_game", "skill_back-end", "skill_front-end", "skill_sys-admin"
                        ]}}
                        order_by: { type: asc, amount: desc }
                    ) {
                        type
                        amount
                    }
                }
            }`;

    const displaySkills = await executeGraphQLQuery(skillsData);
    const transactions = displaySkills.user[0].transactions;

    const skillAmounts = {};
    transactions.forEach(transaction => {
        const skillType = transaction.type.replace("skill_", "");
        if (!skillAmounts[skillType]) {
            skillAmounts[skillType] = transaction.amount;
        }
    });

    skillsChart.innerHTML = '';

    const width = 1400;
    const height = 700;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.4;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const skills = Object.keys(skillAmounts);
    const angleStep = (2 * Math.PI) / skills.length;

    function scaleAmount(amount) {
        return 100 * Math.pow(amount / 100, 0.4);
    }

    skills.forEach((skill, index) => {
        const angle = index * angleStep;
        const rawAmount = skillAmounts[skill] || 0;

        const scaledAmount = scaleAmount(rawAmount);
        const visualAmount = Math.min(100, scaledAmount);
        const filledRadius = radius * (visualAmount / 100);
        const endAngle = angle + angleStep;
        const filledPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        filledPath.setAttribute("d", `
                    M${centerX},${centerY}
                    L${centerX + filledRadius * Math.cos(angle)},${centerY + filledRadius * Math.sin(angle)}
                    A${filledRadius},${filledRadius} 0 0,1 ${centerX + filledRadius * Math.cos(endAngle)},${centerY + filledRadius * Math.sin(endAngle)}
                    Z
                `);
        filledPath.setAttribute("fill", "#3498db");
        filledPath.setAttribute("stroke", "none");
        const emptyPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        emptyPath.setAttribute("d", `
                    M${centerX + filledRadius * Math.cos(angle)},${centerY + filledRadius * Math.sin(angle)}
                    L${centerX + radius * Math.cos(angle)},${centerY + radius * Math.sin(angle)}
                    A${radius},${radius} 0 0,1 ${centerX + radius * Math.cos(endAngle)},${centerY + radius * Math.sin(endAngle)}
                    L${centerX + filledRadius * Math.cos(endAngle)},${centerY + filledRadius * Math.sin(endAngle)}
                    A${filledRadius},${filledRadius} 0 0,0 ${centerX + filledRadius * Math.cos(angle)},${centerY + filledRadius * Math.sin(angle)}
                `);
        emptyPath.setAttribute("fill", "#ffffff");
        emptyPath.setAttribute("stroke", "#ccc");
        emptyPath.setAttribute("stroke-width", "1");
        const hoverPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        hoverPath.setAttribute("d", `
                    M${centerX},${centerY}
                    L${centerX + radius * Math.cos(angle)},${centerY + radius * Math.sin(angle)}
                    A${radius},${radius} 0 0,1 ${centerX + radius * Math.cos(endAngle)},${centerY + radius * Math.sin(endAngle)}
                    Z
                `);
        hoverPath.setAttribute("fill", "transparent");
        hoverPath.setAttribute("data-skill", skill);
        hoverPath.setAttribute("data-amount", rawAmount);
        hoverPath.addEventListener('mouseover', function () {
            filledPath.style.opacity = '0.8';
            emptyPath.style.opacity = '0.8';
            showTooltip(skill, rawAmount);
        });
        hoverPath.addEventListener('mouseout', function () {
            filledPath.style.opacity = '1';
            emptyPath.style.opacity = '1';
            hideTooltip();
        });

        svg.appendChild(filledPath);
        svg.appendChild(emptyPath);
        svg.appendChild(hoverPath);

        const labelAngle = angle + angleStep / 2;
        const labelRadius = radius * 1.1;
        const labelX = centerX + labelRadius * Math.cos(labelAngle);
        const labelY = centerY + labelRadius * Math.sin(labelAngle);

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", labelX);
        text.setAttribute("y", labelY);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("font-size", "13");
        text.textContent = skill;
        svg.appendChild(text);
    });

    const centerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    centerCircle.setAttribute("cx", centerX);
    centerCircle.setAttribute("cy", centerY);
    centerCircle.setAttribute("r", radius * 0.2);
    centerCircle.setAttribute("fill", "#fff");
    centerCircle.setAttribute("stroke", "#333");
    centerCircle.setAttribute("stroke-width", "1");
    svg.appendChild(centerCircle);

    const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
    title.setAttribute("x", centerX);
    title.setAttribute("y", centerY);
    title.setAttribute("text-anchor", "middle");
    title.setAttribute("dominant-baseline", "middle");
    title.setAttribute("font-size", "14");
    title.setAttribute("font-weight", "bold");
    title.textContent = "Skills";
    svg.appendChild(title);
    skillsChart.appendChild(svg);
    function showTooltip(skill, amount) {
        let tooltip = document.getElementById('skill-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'skill-tooltip';
            tooltip.style.position = 'absolute';
            tooltip.style.background = 'rgba(0,0,0,0.7)';
            tooltip.style.color = 'white';
            tooltip.style.padding = '5px 10px';
            tooltip.style.borderRadius = '5px';
            tooltip.style.pointerEvents = 'none';
            document.body.appendChild(tooltip);
        }
        tooltip.textContent = `${skill}: ${amount} %`;
        tooltip.style.display = 'block';
        document.addEventListener('mousemove', positionTooltip);
    }

    function positionTooltip(e) {
        const tooltip = document.getElementById('skill-tooltip');
        if (tooltip) {
            tooltip.style.left = `${e.pageX + 10}px`;
            tooltip.style.top = `${e.pageY + 10}px`;
        }
    }

    function hideTooltip() {
        const tooltip = document.getElementById('skill-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
            document.removeEventListener('mousemove', positionTooltip);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
