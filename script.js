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
        
        // Loading elements
        const userInfoLoading = document.getElementById('user-info-loading');
        const userInfoContent = document.getElementById('user-info-content');
        const projectsLoading = document.getElementById('projects-loading');
        const xpGraphLoading = document.getElementById('xp-graph-loading');
        const passFailLoading = document.getElementById('pass-fail-loading');

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
            await loadUserData();
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
                await loadXpTimeChart();
                await loadSkillsChart();
                
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
                        firstName
                        lastName
                        email
                    }
                }
            `;
            
            const data = await executeGraphQLQuery(query);
            const user = data.user[0];
            console.log(data);
            
            
            // Update UI with user info
            userName.textContent = user.login;
            userFullName.textContent = `${user.firstName} ${user.lastName}`;
            userEmail.textContent = `${user.email}`
            userInitial.textContent = user.login.charAt(0).toUpperCase();

            // Show content, hide loading
            userInfoLoading.classList.add('hidden');
            userInfoContent.classList.remove('hidden');
        }

        async function loadXpAndProjects() {
            const query = `
               {
                  user {
                  auditRatio
                    id
                    # Get 3 most recent passed projects (from both progresses and results)
                    progresses(
                      where: { grade: { _gte: 1 } }
                      order_by: { createdAt: desc }
                      limit: 3
                    ) {
                      id
                      path
                      grade
                      createdAt
                      object {
                        name
                      }
                    }
                    results(
                      where: { grade: { _gte: 1 } }
                      order_by: { createdAt: desc }
                      limit: 3
                    ) {
                      id
                      path
                      grade
                      createdAt
                      object {
                        name
                      }
                    }
                    # Get all XP transactions that might match these projects
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
            
            const data = await executeGraphQLQuery(query);

            const user = data.user[0];

            const transactions = user.transactions
            
            createXpTimeChart(transactions);

            
            // Calculate total XP
            const totalXpAmount = user.transactions.reduce((sum, tx) => sum + tx.amount, 0);
            totalXp.textContent = Math.round(totalXpAmount/1000).toLocaleString()+' kB';
            
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

            // Get the last element in the array (length-1)
            const tr = levelData.user[0].transactions;
            const lastLevel = tr[tr.length - 1].amount;
            userLevel.textContent = `${lastLevel}`;

            console.log("Last Level:", lastLevel);
            // Display recent projects
            projectsLoading.classList.add('hidden');
            
            // For progresses and results (all are passed now)
            if (projects.length > 0) {
                recentPassedProjects.innerHTML = '';
                
                // Combine and sort projects
                const recentProjects = [
                    ...user.progresses,
                    ...user.results
                ].slice(0, 3);

                 console.log(recentProjects);
                 
            
                recentProjects.forEach(project => {
                    // Get project name
                    const pathParts = project.path.split('/').filter(Boolean);
                    const projectName = project.object?.name || pathParts[pathParts.length - 1] || "Unknown Project";
                    
                    // Find the EXACT matching transaction
                    const projectTransaction = user.transactions.find(tx => 
                        tx.path === project.path || 
                        tx.path.endsWith(project.path.split('/').filter(Boolean).join('/'))
                    );
                    
                    // Display with exact XP amount
                    const listItem = document.createElement('li');
                    listItem.className = 'project-item pass';
                    listItem.innerHTML = `
                        <div>${projectName} ${projectTransaction ? `(${projectTransaction.amount/1000} kB)` : ''}</div>
                    `;
                    recentPassedProjects.appendChild(listItem);
                });
            } else {
                recentPassedProjects.innerHTML = '<li class="project-item">No passed projects found.</li>';
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
                        
            
            // Create XP over time chart
            // createXpTimeChart(transactions);
            xpGraphLoading.classList.add('hidden');
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
        
            // Process data
            const skillAmounts = {};
            transactions.forEach(transaction => {
                const skillType = transaction.type.replace("skill_", "");
                if (!skillAmounts[skillType]) {
                    skillAmounts[skillType] = transaction.amount;
                }
            });
        
            // Get the container element
            const skillsChart = document.getElementById('skill-graph');
            skillsChart.innerHTML = ''; // Clear previous content
        
            // SVG dimensions
            const width = 800;
            const height = 500;
            const centerX = width / 2;
            const centerY = height / 2;
            const radius = Math.min(width, height) * 0.4;
        
            // Create SVG element
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", width);
            svg.setAttribute("height", height);
            svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        
            // Create skill segments
            const skills = Object.keys(skillAmounts);
            const angleStep = (2 * Math.PI) / skills.length;
        
            // Add this scaling function before the skills.forEach loop
            function scaleAmount(amount) {
                return 100 * Math.pow(amount/100, 0.4); // Adjust 0.7 for more/less scaling
            }

            skills.forEach((skill, index) => {
                const angle = index * angleStep;
                const rawAmount = skillAmounts[skill] || 0;
                
                // Apply scaling to make small amounts more visible
                const scaledAmount = scaleAmount(rawAmount);
                const visualAmount = Math.min(100, scaledAmount); // Cap at 100%
                
                // Calculate the filled radius with scaled amount
                const filledRadius = radius * (visualAmount / 100);
                
                // Rest of your path creation code remains the same...
                const endAngle = angle + angleStep;
                
                // Create the filled (black) portion
                const filledPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                filledPath.setAttribute("d", `
                    M${centerX},${centerY}
                    L${centerX + filledRadius * Math.cos(angle)},${centerY + filledRadius * Math.sin(angle)}
                    A${filledRadius},${filledRadius} 0 0,1 ${centerX + filledRadius * Math.cos(endAngle)},${centerY + filledRadius * Math.sin(endAngle)}
                    Z
                `);
                filledPath.setAttribute("fill", "#3498db");
                filledPath.setAttribute("stroke", "none");
                
                // Create the empty (white) portion
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
                
                // Create invisible hover area (full segment)
                const hoverPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                hoverPath.setAttribute("d", `
                    M${centerX},${centerY}
                    L${centerX + radius * Math.cos(angle)},${centerY + radius * Math.sin(angle)}
                    A${radius},${radius} 0 0,1 ${centerX + radius * Math.cos(endAngle)},${centerY + radius * Math.sin(endAngle)}
                    Z
                `);
                hoverPath.setAttribute("fill", "transparent");
                hoverPath.setAttribute("data-skill", skill);
                hoverPath.setAttribute("data-amount", rawAmount); // Show original amount in tooltip
                
                // Hover effects
                hoverPath.addEventListener('mouseover', function() {
                    filledPath.style.opacity = '0.8';
                    emptyPath.style.opacity = '0.8';
                    showTooltip(skill, rawAmount); // Show original (unscaled) amount
                });
                hoverPath.addEventListener('mouseout', function() {
                    filledPath.style.opacity = '1';
                    emptyPath.style.opacity = '1';
                    hideTooltip();
                });
                
                svg.appendChild(filledPath);
                svg.appendChild(emptyPath);
                svg.appendChild(hoverPath);
                
                // Labels (unchanged)
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
        
            // Add center circle
            const centerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            centerCircle.setAttribute("cx", centerX);
            centerCircle.setAttribute("cy", centerY);
            centerCircle.setAttribute("r", radius * 0.2);
            centerCircle.setAttribute("fill", "#fff"); 
            centerCircle.setAttribute("stroke", "#333");
            centerCircle.setAttribute("stroke-width", "1");
            svg.appendChild(centerCircle);
        
            // Add title
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
        
        
            // Tooltip functions
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



        // SVG Chart Creation
        function createXpTimeChart(transactions) {
            console.log('Transactions data:', transactions);
            
            // Clear previous chart
            xpTimeGraph.innerHTML = '';
            
            // Process transactions into chart data
            const processedData = [];
            let cumulativeXp = 0;
            
            // Sort transactions by date (oldest first)
            const sortedTransactions = [...transactions].sort((a, b) => 
                new Date(a.createdAt) - new Date(b.createdAt)
            );
            
            // Create cumulative XP data points
            sortedTransactions.forEach(tx => {
                cumulativeXp += tx.amount;
                processedData.push({
                    date: new Date(tx.createdAt),
                    xp: cumulativeXp,
                    amount: tx.amount,
                    path: tx.path
                });
            });
            
            // If no data, show empty state
            if (processedData.length === 0) {
                xpTimeGraph.innerHTML = '<text x="50%" y="50%" text-anchor="middle">No XP data available</text>';
                return;
            }
            
            // Chart dimensions
            const width = xpTimeGraph.clientWidth;
            const height = 400;
            const margin = { top: 40, right: 40, bottom: 60, left: 80 };
            const chartWidth = width - margin.left - margin.right;
            const chartHeight = height - margin.top - margin.bottom;
            
            // Find min/max values
            const dateExtent = [processedData[0].date, processedData[processedData.length - 1].date];
            const xpMax = processedData[processedData.length - 1].xp;
            
            // Create scales
            const xScale = (x) => {
                return margin.left + (x - dateExtent[0]) / (dateExtent[1] - dateExtent[0]) * chartWidth;
            };
            
            const yScale = (y) => {
                return height - margin.bottom - (y / xpMax) * chartHeight;
            };
            
            // Create SVG elements
            const svgNS = 'http://www.w3.org/2000/svg';
            const chartGroup = document.createElementNS(svgNS, 'g');
            
            // Create axes
            // X-axis line
            const xAxis = document.createElementNS(svgNS, 'line');
            xAxis.setAttribute('x1', margin.left);
            xAxis.setAttribute('y1', height - margin.bottom);
            xAxis.setAttribute('x2', width - margin.right);
            xAxis.setAttribute('y2', height - margin.bottom);
            xAxis.setAttribute('class', 'axis-line');
            chartGroup.appendChild(xAxis);
            
            // Y-axis line
            const yAxis = document.createElementNS(svgNS, 'line');
            yAxis.setAttribute('x1', margin.left);
            yAxis.setAttribute('y1', margin.top);
            yAxis.setAttribute('x2', margin.left);
            yAxis.setAttribute('y2', height - margin.bottom);
            yAxis.setAttribute('class', 'axis-line');
            chartGroup.appendChild(yAxis);
            
            // X-axis label
            const xLabel = document.createElementNS(svgNS, 'text');
            xLabel.setAttribute('x', margin.left + chartWidth / 2);
            xLabel.setAttribute('y', height - 15);
            xLabel.setAttribute('text-anchor', 'middle');
            xLabel.textContent = 'Timeline';
            chartGroup.appendChild(xLabel);
            
            // Y-axis label
            const yLabel = document.createElementNS(svgNS, 'text');
            yLabel.setAttribute('transform', `translate(13, ${margin.top + chartHeight / 2}) rotate(-90)`);
            yLabel.setAttribute('text-anchor', 'middle');
            yLabel.textContent = 'Cumulative XP';
            chartGroup.appendChild(yLabel);
            
            // Title
            const title = document.createElementNS(svgNS, 'text');
            title.setAttribute('x', margin.left + chartWidth / 2);
            title.setAttribute('y', margin.top - 10);
            title.setAttribute('text-anchor', 'middle');
            title.setAttribute('font-weight', 'bold');
            title.textContent = 'XP Progress Over Time';
            chartGroup.appendChild(title);
            
            // X-axis ticks (months/years)
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const tickCount = Math.min(5, processedData.length);
            const tickInterval = (dateExtent[1] - dateExtent[0]) / (tickCount - 1);
            
            for (let i = 0; i < tickCount; i++) {
                const tickDate = new Date(dateExtent[0].getTime() + tickInterval * i);
                const tickX = xScale(tickDate);
                
                // Tick line
                const tickLine = document.createElementNS(svgNS, 'line');
                tickLine.setAttribute('x1', tickX);
                tickLine.setAttribute('y1', height - margin.bottom);
                tickLine.setAttribute('x2', tickX);
                tickLine.setAttribute('y2', height - margin.bottom + 5);
                tickLine.setAttribute('stroke', '#666');
                chartGroup.appendChild(tickLine);
                
                // Tick label
                const tickLabel = document.createElementNS(svgNS, 'text');
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
                const tickLine = document.createElementNS(svgNS, 'line');
                tickLine.setAttribute('x1', margin.left - 5);
                tickLine.setAttribute('y1', tickY);
                tickLine.setAttribute('x2', margin.left);
                tickLine.setAttribute('y2', tickY);
                tickLine.setAttribute('stroke', '#666');
                chartGroup.appendChild(tickLine);
                
                // Grid line
                const gridLine = document.createElementNS(svgNS, 'line');
                gridLine.setAttribute('x1', margin.left);
                gridLine.setAttribute('y1', tickY);
                gridLine.setAttribute('x2', width - margin.right);
                gridLine.setAttribute('y2', tickY);
                gridLine.setAttribute('stroke', '#eee');
                gridLine.setAttribute('stroke-dasharray', '3,3');
                chartGroup.appendChild(gridLine);
                
                // Tick label
                const tickLabel = document.createElementNS(svgNS, 'text');
                tickLabel.setAttribute('x', margin.left - 10);
                tickLabel.setAttribute('y', tickY + 5);
                tickLabel.setAttribute('text-anchor', 'end');
                tickLabel.setAttribute('class', 'axis-text');
                tickLabel.textContent = Math.round(tickValue).toLocaleString();
                chartGroup.appendChild(tickLabel);
            }
            
            // Create the path for XP line
            let pathD = `M ${xScale(processedData[0].date)} ${yScale(processedData[0].xp)}`;
            for (let i = 1; i < processedData.length; i++) {
                pathD += ` L ${xScale(processedData[i].date)} ${yScale(processedData[i].xp)}`;
            }
            
            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d', pathD);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', 'var(--primary-color)');
            path.setAttribute('stroke-width', 3);
            chartGroup.appendChild(path);
            
            console.log("processedData", processedData);
            
            // Add data points for significant transactions
            processedData.forEach((d, i) => {
                // Only add points for significant XP gains or first/last points
                if (i === 0 || i === processedData.length - 1 || d.amount > xpMax * 0.01) {
                    const circle = document.createElementNS(svgNS, 'circle');
                    circle.setAttribute('cx', xScale(d.date));
                    circle.setAttribute('cy', yScale(d.xp));
                    circle.setAttribute('r', 5);
                    circle.setAttribute('fill', 'var(--secondary-color)');
                    
                    // Add hover effect and tooltip
                    circle.addEventListener('mouseover', (e) => {
                        circle.setAttribute('r', 7);
                        
                        // Extract project name from path
                        const pathParts = d.path.split('/').filter(Boolean);
                        const projectName = pathParts[pathParts.length - 1] || "XP Gain";
                        
                        // Show tooltip
                        tooltip.style.opacity = 1;
                        tooltip.style.left = `${e.pageX + 10}px`;
                        tooltip.style.top = `${e.pageY - 30}px`;
                        tooltip.innerHTML = `
                            <strong>${projectName}</strong><br>
                            Date: ${d.date.toLocaleDateString()}<br>
                            XP: ${Math.round(d.amount/1000).toLocaleString()+' kB'}<br>
                            Total: ${Math.round(d.xp/1000).toLocaleString()+' kB'}
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



// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
checkAuth();
});

// Responsive handling
window.addEventListener('resize', () => {
// If charts data exists, redraw charts on window resize
const xpChartTab = document.getElementById('xp-graph');
const passFailTab = document.getElementById('skill-graph');

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
