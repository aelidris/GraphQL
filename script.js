        // DOM elements
        const loginPage = document.getElementById('login-page');
        const profilePage = document.getElementById('profile-page');
        const loginForm = document.getElementById('login-form');
        const errorMessage = document.getElementById('error-message');
        const logoutBtn = document.getElementById('logout-btn');
        
        // User info elements
        const userInitial = document.getElementById('user-initial');
        const userName = document.getElementById('user-name');
        const userId = document.getElementById('user-id');
        const totalXp = document.getElementById('total-xp');
        const projectsCount = document.getElementById('projects-count');
        const passRatio = document.getElementById('pass-ratio');
        const projectsList = document.getElementById('projects-list');
        
        // Loading elements
        const userInfoLoading = document.getElementById('user-info-loading');
        const userInfoContent = document.getElementById('user-info-content');
        const projectsLoading = document.getElementById('projects-loading');
        const xpGraphLoading = document.getElementById('xp-graph-loading');
        const passFailLoading = document.getElementById('pass-fail-loading');

        // Graph elements
        const xpTimeGraph = document.getElementById('xp-time-graph');
        const passFailChart = document.getElementById('pass-fail-chart');
        const passFailLegend = document.getElementById('pass-fail-legend');
        const tooltip = document.getElementById('tooltip');

        // Tab management
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                
                // Update active button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update active content
                tabContents.forEach(content => content.classList.remove('active'));
                document.getElementById(tabId).classList.add('active');
            });
        });

        // Global variables
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

        // Event Listeners
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            try {
                await login(username, password);
            } catch (error) {
                errorMessage.style.display = 'block';
                console.error('Login error:', error);
            }
        });

        logoutBtn.addEventListener('click', () => {
            logout();
        });

        // Authentication Functions
        async function login(username, password) {
            const credentials = btoa(`${username}:${password}`);
            
            const response = await fetch(`${API_URL}/auth/signin`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${credentials}`
                }
            });

            if (!response.ok) {
                throw new Error('Invalid credentials');
            }

            const token = await response.json();
            authToken = token;
            
            // Save token to local storage
            localStorage.setItem('authToken', token);
            
            // Hide error message if it was visible
            errorMessage.style.display = 'none';
            
            // Show profile page
            showProfilePage();
            
            // Load user data
            loadUserData();
        }

        function logout() {
            // Clear token and return to login page
            localStorage.removeItem('authToken');
            authToken = '';
            showLoginPage();
        }

        function showProfilePage() {
            loginPage.classList.add('hidden');
            profilePage.classList.remove('hidden');
        }

        function showLoginPage() {
            profilePage.classList.add('hidden');
            loginPage.classList.remove('hidden');
        }

        // GraphQL Queries
        async function executeGraphQLQuery(query, variables = {}) {
            const response = await fetch(GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    query,
                    variables
                })
            });

            if (!response.ok) {
                throw new Error('GraphQL query failed');
            }

            const data = await response.json();
            
            if (data.errors) {
                console.error('GraphQL errors:', data.errors);
                throw new Error(data.errors[0].message);
            }
            
            return data.data;
        }

        // Data Loading Functions
        async function loadUserData() {
            try {
                // Get basic user info
                await loadBasicUserInfo();
                
                // Load XP and projects data
                await loadXpAndProjects();
                
                // Load charts data
                loadXpTimeChart();
                loadPassFailChart();
                
            } catch (error) {
                console.error('Error loading user data:', error);
                // If unauthorized, redirect to login
                if (error.message.includes('unauthorized')) {
                    logout();
                }
            }
        }

        async function loadBasicUserInfo() {
            const query = `
                {
                    user {
                        id
                        login
                    }
                }
            `;
            
            const data = await executeGraphQLQuery(query);
            const user = data.user[0];
            
            // Update UI with user info
            userName.textContent = user.login;
            userId.textContent = `ID: ${user.id}`;
            userInitial.textContent = user.login.charAt(0).toUpperCase();

            // Show content, hide loading
            userInfoLoading.classList.add('hidden');
            userInfoContent.classList.remove('hidden');
        }

        async function loadXpAndProjects() {
            const query = `
                {
                    user {
                        id
                        transactions(where: {type: {_eq: "xp"}}) {
                            id
                            amount
                            createdAt
                            path
                        }
                        progresses(order_by: {createdAt: desc}) {
                            id
                            grade
                            path
                            createdAt
                            object {
                                id
                                name
                                type
                            }
                        }
                        results(order_by: {createdAt: desc}) {
                            id
                            grade
                            path
                            createdAt
                            object {
                                id
                                name
                                type
                            }
                        }
                    }
                }
            `;
            
            const data = await executeGraphQLQuery(query);
            const user = data.user[0];
            
            // Calculate total XP
            const totalXpAmount = user.transactions.reduce((sum, tx) => sum + tx.amount, 0);
            totalXp.textContent = Math.round(totalXpAmount).toLocaleString();
            
            // Get projects from both results and progresses
            // First check results for projects
            let projects = user.results.filter(r => 
                r.object && r.object.type === "project" && r.path && !r.path.includes("piscine")
            );
            
            // If no projects in results, try progresses
            if (projects.length === 0) {
                projects = user.progresses.filter(p => 
                    p.object && p.object.type === "project" && p.path && !p.path.includes("piscine")
                );
            }
            
            // If still no projects, check for any result/progress with a path containing typical project identifiers
            if (projects.length === 0) {
                const projectKeywords = ["graphql", "profile", "ascii-art", "groupie-tracker", "social-network", "forum"];
                
                projects = [...user.results, ...user.progresses].filter(item => 
                    item.path && projectKeywords.some(keyword => item.path.toLowerCase().includes(keyword))
                );
            }
            
            // Count projects
            projectsCount.textContent = projects.length;
            
            // Calculate pass ratio - only if we have projects
            const passedProjects = projects.filter(p => p.grade >= 1).length;
            const passRatioValue = projects.length > 0 
                ? Math.round((passedProjects / projects.length) * 100) 
                : 0;
            passRatio.textContent = `${passRatioValue}%`;
            
            // Display recent projects
            projectsLoading.classList.add('hidden');
            
            if (projects.length > 0) {
                // Sort by most recent first
                const sortedProjects = [...projects].sort((a, b) => 
                    new Date(b.createdAt) - new Date(a.createdAt)
                ).slice(0, 5); // Take only 5 most recent
                
                projectsList.innerHTML = '';
                sortedProjects.forEach(project => {
                    // Extract project name from path
                    let projectName = "Unknown Project";
                    if (project.path) {
                        const pathParts = project.path.split('/');
                        projectName = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2] || "Unknown Project";
                    }
                    
                    const status = project.grade >= 1 ? 'PASS' : 'FAIL';
                    const statusClass = project.grade >= 1 ? 'pass' : 'fail';
                    
                    const listItem = document.createElement('li');
                    listItem.className = 'project-item';
                    listItem.innerHTML = `
                        <div>${projectName}</div>
                        <div class="${statusClass}">${status}</div>
                    `;
                    
                    projectsList.appendChild(listItem);
                });
            } else {
                // No projects found
                projectsList.innerHTML = '<li class="project-item">No projects found. You might need to complete some projects first.</li>';
            }
        }

        async function loadXpTimeChart() {
            const query = `
                {
                    user {
                        transactions(where: {type: {_eq: "xp"}}, order_by: {createdAt: asc}) {
                            amount
                            createdAt
                            path
                        }
                    }
                }
            `;
            
            const data = await executeGraphQLQuery(query);
            const transactions = data.user[0].transactions;
            
            // Process data for the chart
            let cumulativeXp = 0;
            const chartData = transactions.map(tx => {
                cumulativeXp += tx.amount;
                return {
                    date: new Date(tx.createdAt),
                    xp: cumulativeXp,
                    project: tx.path.split('/').pop()
                };
            });
            
            // Create XP over time chart
            createXpTimeChart(chartData);
            xpGraphLoading.classList.add('hidden');
        }

        async function loadPassFailChart() {
            const query = `
                {
                    user {
                        progresses(where: {object: {type: {_eq: "project"}}}) {
                            grade
                            path
                        }
                        results(where: {object: {type: {_eq: "project"}}}) {
                            grade
                            path
                        }
                    }
                }
            `;
            
            const data = await executeGraphQLQuery(query);
            
            // Combine projects from both results and progresses
            let allProjects = [...data.user[0].results, ...data.user[0].progresses];
            
            // Filter out duplicates and piscine exercises
            let projectPaths = new Set();
            let uniqueProjects = allProjects.filter(p => {
                if (!p.path || p.path.includes("piscine")) return false;
                
                if (!projectPaths.has(p.path)) {
                    projectPaths.add(p.path);
                    return true;
                }
                return false;
            });
            
            // If we don't have any projects, try to find anything that looks like a project
            if (uniqueProjects.length === 0) {
                const projectKeywords = ["graphql", "profile", "ascii-art", "groupie-tracker", "social-network", "forum"];
                
                uniqueProjects = allProjects.filter(item => 
                    item.path && projectKeywords.some(keyword => item.path.toLowerCase().includes(keyword))
                );
            }
            
            // Calculate pass/fail counts
            const passed = uniqueProjects.filter(r => r.grade >= 1).length;
            const failed = uniqueProjects.filter(r => r.grade < 1).length;
            
            // Save data for potential redraw
            passFailChart.__data__ = { passed, failed };
            
            // Handle the case where there are no projects
            if (passed === 0 && failed === 0) {
                // Display a message instead of an empty chart
                passFailChart.innerHTML = `
                    <text x="50%" y="50%" text-anchor="middle" font-size="16px">
                        No project data available yet
                    </text>
                `;
                passFailLegend.innerHTML = '';
            } else {
                // Create pie chart
                createPassFailChart(passed, failed);
            }
            
            passFailLoading.classList.add('hidden');
        }

        // SVG Chart Creation
        function createXpTimeChart(data) {
            // Clear previous chart
            xpTimeGraph.innerHTML = '';
            
            // Chart dimensions
            const width = xpTimeGraph.clientWidth;
            const height = 400;
            const margin = { top: 40, right: 40, bottom: 60, left: 80 };
            const chartWidth = width - margin.left - margin.right;
            const chartHeight = height - margin.top - margin.bottom;
            
            // Parse dates and find min/max values
            const dateExtent = [data[0].date, data[data.length - 1].date];
            const xpMax = data[data.length - 1].xp;
            
            // Create scales
            const xScale = (x) => {
                return margin.left + (x - dateExtent[0]) / (dateExtent[1] - dateExtent[0]) * chartWidth;
            };
            
            const yScale = (y) => {
                return height - margin.bottom - (y / xpMax) * chartHeight;
            };
            
            // Create chart group
            const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            
            // Create axes
            // X-axis
            const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            xAxis.setAttribute('x1', margin.left);
            xAxis.setAttribute('y1', height - margin.bottom);
            xAxis.setAttribute('x2', width - margin.right);
            xAxis.setAttribute('y2', height - margin.bottom);
            xAxis.setAttribute('class', 'axis-line');
            chartGroup.appendChild(xAxis);
            
            // Y-axis
            const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            yAxis.setAttribute('x1', margin.left);
            yAxis.setAttribute('y1', margin.top);
            yAxis.setAttribute('x2', margin.left);
            yAxis.setAttribute('y2', height - margin.bottom);
            yAxis.setAttribute('class', 'axis-line');
            chartGroup.appendChild(yAxis);
            
            // X-axis label
            const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            xLabel.setAttribute('x', margin.left + chartWidth / 2);
            xLabel.setAttribute('y', height - 15);
            xLabel.setAttribute('text-anchor', 'middle');
            xLabel.textContent = 'Timeline';
            chartGroup.appendChild(xLabel);
            
            // Y-axis label
            const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            yLabel.setAttribute('transform', `translate(25, ${margin.top + chartHeight / 2}) rotate(-90)`);
            yLabel.setAttribute('text-anchor', 'middle');
            yLabel.textContent = 'Cumulative XP';
            chartGroup.appendChild(yLabel);
            
            // Title
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            title.setAttribute('x', margin.left + chartWidth / 2);
            title.setAttribute('y', margin.top - 10);
            title.setAttribute('text-anchor', 'middle');
            title.setAttribute('font-weight', 'bold');
            title.textContent = 'XP Progress Over Time';
            chartGroup.appendChild(title);
            
            // X-axis ticks
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const tickCount = 5;
            const tickInterval = (dateExtent[1] - dateExtent[0]) / (tickCount - 1);
            
            for (let i = 0; i < tickCount; i++) {
                const tickDate = new Date(dateExtent[0].getTime() + tickInterval * i);
                const tickX = xScale(tickDate);
                
                // Tick line
                const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                tickLine.setAttribute('x1', tickX);
                tickLine.setAttribute('y1', height - margin.bottom);
                tickLine.setAttribute('x2', tickX);
                tickLine.setAttribute('y2', height - margin.bottom + 5);
                tickLine.setAttribute('stroke', '#666');
                chartGroup.appendChild(tickLine);
                
                // Tick label
                const tickLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                tickLabel.setAttribute('x', tickX);
                tickLabel.setAttribute('y', height - margin.bottom + 20);
                tickLabel.setAttribute('text-anchor', 'middle');
                tickLabel.setAttribute('class', 'axis-text');
                tickLabel.textContent = `${monthNames[tickDate.getMonth()]} ${tickDate.getFullYear()}`;
                chartGroup.appendChild(tickLabel);
            }
            
            // Y-axis ticks
            const yTickCount = 5;
            for (let i = 0; i <= yTickCount; i++) {
                const tickValue = (xpMax / yTickCount) * i;
                const tickY = yScale(tickValue);
                
                // Tick line
                const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                tickLine.setAttribute('x1', margin.left - 5);
                tickLine.setAttribute('y1', tickY);
                tickLine.setAttribute('x2', margin.left);
                tickLine.setAttribute('y2', tickY);
                tickLine.setAttribute('stroke', '#666');
                chartGroup.appendChild(tickLine);
                
                // Grid line
                const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                gridLine.setAttribute('x1', margin.left);
                gridLine.setAttribute('y1', tickY);
                gridLine.setAttribute('x2', width - margin.right);
                gridLine.setAttribute('y2', tickY);
                gridLine.setAttribute('stroke', '#eee');
                gridLine.setAttribute('stroke-dasharray', '3,3');
                chartGroup.appendChild(gridLine);
                
                // Tick label
                const tickLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                tickLabel.setAttribute('x', margin.left - 10);
                tickLabel.setAttribute('y', tickY + 5);
                tickLabel.setAttribute('text-anchor', 'end');
                tickLabel.setAttribute('class', 'axis-text');
                tickLabel.textContent = Math.round(tickValue).toLocaleString();
                chartGroup.appendChild(tickLabel);
            }
            
            // Create the path for XP line
            let pathD = `M ${xScale(data[0].date)} ${yScale(data[0].xp)}`;
            for (let i = 1; i < data.length; i++) {
                pathD += ` L ${xScale(data[i].date)} ${yScale(data[i].xp)}`;
            }
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathD);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', 'var(--primary-color)');
            path.setAttribute('stroke-width', 3);
            chartGroup.appendChild(path);
            
            // Add data points
            data.forEach((d, i) => {
                // Only add points for significant XP gains (to avoid cluttering)
                if (i === 0 || i === data.length - 1 || d.xp - data[i-1].xp > xpMax * 0.03) {
                    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    circle.setAttribute('cx', xScale(d.date));
                    circle.setAttribute('cy', yScale(d.xp));
                    circle.setAttribute('r', 5);
                    circle.setAttribute('fill', 'var(--secondary-color)');
                    
                    // Add hover effect and tooltip
                    circle.addEventListener('mouseover', (e) => {
                        circle.setAttribute('r', 7);
                        
                        // Show tooltip
                        tooltip.style.opacity = 1;
                        tooltip.style.left = `${e.pageX + 10}px`;
                        tooltip.style.top = `${e.pageY - 30}px`;
                        tooltip.innerHTML = `
                            <strong>${d.project}</strong><br>
                            Date: ${d.date.toLocaleDateString()}<br>
                            XP: ${Math.round(d.xp).toLocaleString()}
                        `;
                    });
                    
                

circle.addEventListener('mouseout', () => {
    circle.setAttribute('r', 5);
    tooltip.style.opacity = 0;
});

chartGroup.appendChild(circle);
}
});

// Add the chart to the SVG
xpTimeGraph.appendChild(chartGroup);
}

function createPassFailChart(passed, failed) {
// Clear previous chart
passFailChart.innerHTML = '';
passFailLegend.innerHTML = '';

// Chart dimensions
const width = passFailChart.clientWidth;
const height = 400;
const radius = Math.min(width, height) / 3;
const centerX = width / 2;
const centerY = height / 2;

// Calculate total and angles
const total = passed + failed;
const passedAngle = passed / total * 360;
const failedAngle = failed / total * 360;

// Colors
const colors = ['#2ecc71', '#e74c3c']; // Green for passed, red for failed

// Create pie chart
const pieGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
pieGroup.setAttribute('transform', `translate(${centerX}, ${centerY})`);

// Title
const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
title.setAttribute('x', 0);
title.setAttribute('y', -radius - 20);
title.setAttribute('text-anchor', 'middle');
title.setAttribute('font-weight', 'bold');
title.textContent = 'Project Pass/Fail Ratio';
pieGroup.appendChild(title);

// Helper function to convert degrees to radians
const degToRad = (degrees) => {
return degrees * Math.PI / 180;
};

// Helper function to calculate point on circle
const pointOnCircle = (angle, radius) => {
return {
x: Math.cos(degToRad(angle - 90)) * radius,
y: Math.sin(degToRad(angle - 90)) * radius
};
};

// Create pie segments
let startAngle = 0;
const segments = [
{ value: passed, label: 'Passed', angle: passedAngle },
{ value: failed, label: 'Failed', angle: failedAngle }
];

segments.forEach((segment, i) => {
if (segment.value === 0) return; // Skip empty segments

const endAngle = startAngle + segment.angle;

// Calculate path
const start = pointOnCircle(startAngle, radius);
const end = pointOnCircle(endAngle, radius);

// Determine if the arc is more than 180 degrees
const largeArcFlag = segment.angle > 180 ? 1 : 0;

// Create path for pie segment
const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
const d = [
`M 0 0`,
`L ${start.x} ${start.y}`,
`A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
'Z'
].join(' ');

path.setAttribute('d', d);
path.setAttribute('fill', colors[i]);
path.setAttribute('class', 'pie-segment');

// Add hover effect and tooltip
path.addEventListener('mouseover', (e) => {
// Show tooltip
tooltip.style.opacity = 1;
tooltip.style.left = `${e.pageX + 10}px`;
tooltip.style.top = `${e.pageY - 30}px`;
tooltip.innerHTML = `
    <strong>${segment.label}</strong><br>
    Count: ${segment.value}<br>
    Percentage: ${Math.round(segment.value / total * 100)}%
`;
});

path.addEventListener('mouseout', () => {
tooltip.style.opacity = 0;
});

pieGroup.appendChild(path);

// Add percentage label if segment is large enough to fit text
if (segment.angle > 20) {
const midAngle = startAngle + segment.angle / 2;
const labelPos = pointOnCircle(midAngle, radius * 0.65);

const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
label.setAttribute('x', labelPos.x);
label.setAttribute('y', labelPos.y);
label.setAttribute('text-anchor', 'middle');
label.setAttribute('fill', 'white');
label.setAttribute('font-weight', 'bold');
label.textContent = `${Math.round(segment.value / total * 100)}%`;

pieGroup.appendChild(label);
}

startAngle = endAngle;
});

// Add the pie chart to the SVG
passFailChart.appendChild(pieGroup);

// Create legend
segments.forEach((segment, i) => {
if (segment.value === 0) return; // Skip empty segments

const legendItem = document.createElement('div');
legendItem.className = 'legend-item';

const colorBox = document.createElement('div');
colorBox.className = 'legend-color';
colorBox.style.backgroundColor = colors[i];

const label = document.createElement('div');
label.textContent = `${segment.label}: ${segment.value} (${Math.round(segment.value / total * 100)}%)`;

legendItem.appendChild(colorBox);
legendItem.appendChild(label);
passFailLegend.appendChild(legendItem);
});
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
checkAuth();
});

// Responsive handling
window.addEventListener('resize', () => {
// If charts data exists, redraw charts on window resize
const xpChartTab = document.getElementById('xp-graph');
const passFailTab = document.getElementById('pass-fail-graph');

if (xpChartTab.classList.contains('active')) {
const xpTimeGraphData = xpTimeGraph.__data__;
if (xpTimeGraphData) {
createXpTimeChart(xpTimeGraphData);
}
} else if (passFailTab.classList.contains('active')) {
const passedData = passFailChart.__data__?.passed;
const failedData = passFailChart.__data__?.failed;
if (passedData !== undefined && failedData !== undefined) {
createPassFailChart(passedData, failedData);
}
}
});
