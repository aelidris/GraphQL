        // DOM Elements
        const loginForm = document.getElementById('login-form');
        const loginError = document.getElementById('login-error');
        const loginContainer = document.getElementById('login-container');
        const profileContainer = document.getElementById('profile-container');
        const logoutBtn = document.getElementById('logout-btn');
        const userGreeting = document.getElementById('user-greeting');
        
        // State
        let jwtToken = localStorage.getItem('jwtToken');
        let userId = localStorage.getItem('userId');
        
        // Check if user is already logged in
        if (jwtToken && userId) {
            showProfile();
            fetchProfileData();
        }
        
        // Event Listeners
        loginForm.addEventListener('submit', handleLogin);
        logoutBtn.addEventListener('click', handleLogout);
        
        // Functions
        async function handleLogin(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            try {
                loginError.textContent = '';
                const response = await fetch('https://zone01oujda.ma/api/auth/signin', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + btoa(username + ':' + password),
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error('Invalid credentials');
                }
                
                const data = await response.json();
                jwtToken = data;
                localStorage.setItem('jwtToken', jwtToken);
                
                // Extract user ID from JWT
                const payload = JSON.parse(atob(jwtToken.split('.')[1]));
                userId = payload.userId;
                localStorage.setItem('userId', userId);
                
                showProfile();
                fetchProfileData();
            } catch (error) {
                console.error('Login error:', error);
                loginError.textContent = 'Login failed. Please check your credentials and try again.';
            }
        }
        
        function handleLogout() {
            jwtToken = null;
            userId = null;
            localStorage.removeItem('jwtToken');
            localStorage.removeItem('userId');
            showLogin();
        }
        
        function showLogin() {
            loginContainer.style.display = 'block';
            profileContainer.style.display = 'none';
            logoutBtn.style.display = 'none';
            userGreeting.textContent = '';
            loginForm.reset();
        }
        
        function showProfile() {
            loginContainer.style.display = 'none';
            profileContainer.style.display = 'block';
            logoutBtn.style.display = 'block';
            userGreeting.textContent = 'Welcome!';
        }
        
        async function fetchProfileData() {
            if (!jwtToken || !userId) return;
            
            try {
                // Fetch basic user info
                const userQuery = `
                    query GetUserInfo($userId: bigint!) {
                        user(where: {id: {_eq: $userId}}) {
                            id
                            login
                            firstName: attrs(path: "$.first_name")
                            lastName: attrs(path: "$.last_name")
                        }
                    }
                `;
                
                const userResponse = await makeGraphQLRequest(userQuery, { userId: parseInt(userId) });
                const userData = userResponse.data.user[0];
                
                document.getElementById('user-name').textContent = 
                    `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.login;
                document.getElementById('user-login').textContent = `@${userData.login}`;
                document.getElementById('user-avatar').textContent = userData.login.charAt(0).toUpperCase();
                
                // Fetch XP data
                const xpQuery = `
                    query GetXpData($userId: bigint!) {
                        transaction(
                            where: {userId: {_eq: $userId}, type: {_eq: "xp"}},
                            order_by: {createdAt: asc}
                        ) {
                            amount
                            createdAt
                            path
                        }
                        
                        transaction_aggregate(
                            where: {userId: {_eq: $userId}, type: {_eq: "xp"}}
                        ) {
                            aggregate {
                                sum {
                                    amount
                                }
                            }
                        }
                    }
                `;
                
                const xpResponse = await makeGraphQLRequest(xpQuery, { userId: parseInt(userId) });
                const totalXp = xpResponse.data.transaction_aggregate.aggregate.sum.amount || 0;
                document.getElementById('total-xp').textContent = totalXp.toLocaleString();
                
                // Fetch audit ratio
                const auditQuery = `
                    query GetAuditRatio($userId: bigint!) {
                        audit_ratio: transaction_aggregate(
                            where: {
                                userId: {_eq: $userId},
                                type: {_in: ["up", "down"]}
                            }
                        ) {
                            aggregate {
                                count
                                sum {
                                    amount
                                }
                            }
                        }
                    }
                `;
                
                const auditResponse = await makeGraphQLRequest(auditQuery, { userId: parseInt(userId) });
                const auditData = auditResponse.data.audit_ratio.aggregate;
                const auditRatio = (auditData.sum.amount / auditData.count).toFixed(2);
                document.getElementById('audit-ratio').textContent = auditRatio;
                
                // Fetch project data
                const projectsQuery = `
                    query GetProjectData($userId: bigint!) {
                        progress(
                            where: {
                                userId: {_eq: $userId},
                                object: {type: {_eq: "project"}}
                            }
                        ) {
                            grade
                            object {
                                name
                            }
                        }
                        
                        progress_aggregate(
                            where: {
                                userId: {_eq: $userId},
                                object: {type: {_eq: "project"}}
                            }
                        ) {
                            aggregate {
                                count
                            }
                        }
                    }
                `;
                
                const projectsResponse = await makeGraphQLRequest(projectsQuery, { userId: parseInt(userId) });
                const projectsCompleted = projectsResponse.data.progress_aggregate.aggregate.count;
                document.getElementById('projects-completed').textContent = projectsCompleted;
                
                // Calculate piscine stats
                const piscineProjects = projectsResponse.data.progress.filter(p => 
                    p.object.name.includes('piscine') || p.path.includes('piscine'));
                const piscineGrade = piscineProjects.length > 0 ? 
                    (piscineProjects.reduce((sum, p) => sum + p.grade, 0) / piscineProjects.length ): 0;
                document.getElementById('piscine-grade').textContent = `${Math.round(piscineGrade * 100)}%`;
                
                // Create charts
                createXpChart(xpResponse.data.transaction);
                createProjectsChart(projectsResponse.data.progress);
                
            } catch (error) {
                console.error('Error fetching profile data:', error);
            }
        }
        
        async function makeGraphQLRequest(query, variables = {}) {
            const response = await fetch('https://zone01oujda.ma/api/graphql-engine/v1/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwtToken}`
                },
                body: JSON.stringify({
                    query,
                    variables
                })
            });
            
            if (!response.ok) {
                throw new Error('GraphQL request failed');
            }
            
            return await response.json();
        }
        
        function createXpChart(transactions) {
            const container = document.getElementById('xp-chart');
            container.innerHTML = '';
            
            if (transactions.length === 0) {
                container.innerHTML = '<p>No XP data available</p>';
                return;
            }
            
            // Process data
            const data = transactions.map(t => ({
                date: new Date(t.createdAt),
                amount: t.amount,
                cumulative: 0
            }));
            
            // Calculate cumulative XP
            let cumulativeXp = 0;
            data.forEach(item => {
                cumulativeXp += item.amount;
                item.cumulative = cumulativeXp;
            });
            
            // Chart dimensions
            const width = container.clientWidth;
            const height = 400;
            const margin = { top: 20, right: 30, bottom: 40, left: 60 };
            const innerWidth = width - margin.left - margin.right;
            const innerHeight = height - margin.top - margin.bottom;
            
            // Create SVG
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", "100%");
            svg.setAttribute("height", "100%");
            svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
            container.appendChild(svg);
            
            // Create group for chart
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("transform", `translate(${margin.left},${margin.top})`);
            svg.appendChild(g);
            
            // X scale (time)
            const xExtent = [data[0].date, data[data.length - 1].date];
            const xScale = (date) => {
                const range = xExtent[1] - xExtent[0];
                return ((date - xExtent[0]) / range) * innerWidth;
            };
            
            // Y scale (cumulative XP)
            const yMax = Math.max(...data.map(d => d.cumulative));
            const yScale = (value) => innerHeight - (value / yMax) * innerHeight;
            
            // Create line
            const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
            let pathData = `M ${xScale(data[0].date)} ${yScale(data[0].cumulative)}`;
            
            for (let i = 1; i < data.length; i++) {
                pathData += ` L ${xScale(data[i].date)} ${yScale(data[i].cumulative)}`;
            }
            
            line.setAttribute("d", pathData);
            line.setAttribute("fill", "none");
            line.setAttribute("stroke", "var(--accent)");
            line.setAttribute("stroke-width", "2");
            g.appendChild(line);
            
            // Add circles for data points
            data.forEach((point, i) => {
                if (i % Math.floor(data.length / 10) === 0) { // Show every 10th point
                    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    circle.setAttribute("cx", xScale(point.date));
                    circle.setAttribute("cy", yScale(point.cumulative));
                    circle.setAttribute("r", "4");
                    circle.setAttribute("fill", "var(--primary)");
                    circle.setAttribute("stroke", "white");
                    circle.setAttribute("stroke-width", "1");
                    
                    // Tooltip
                    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
                    title.textContent = `${point.date.toLocaleDateString()}\nXP: ${point.amount}\nTotal: ${point.cumulative}`;
                    circle.appendChild(title);
                    
                    g.appendChild(circle);
                }
            });
            
            // Add X axis
            const xAxis = document.createElementNS("http://www.w3.org/2000/svg", "path");
            xAxis.setAttribute("d", `M 0 ${innerHeight} H ${innerWidth}`);
            xAxis.setAttribute("stroke", "#ccc");
            xAxis.setAttribute("stroke-width", "1");
            g.appendChild(xAxis);
            
            // Add Y axis
            const yAxis = document.createElementNS("http://www.w3.org/2000/svg", "path");
            yAxis.setAttribute("d", `M 0 0 V ${innerHeight}`);
            yAxis.setAttribute("stroke", "#ccc");
            yAxis.setAttribute("stroke-width", "1");
            g.appendChild(yAxis);
            
            // Add axis labels
            const xLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
            xLabel.setAttribute("x", innerWidth / 2);
            xLabel.setAttribute("y", innerHeight + margin.bottom - 10);
            xLabel.setAttribute("text-anchor", "middle");
            xLabel.setAttribute("fill", "#666");
            xLabel.textContent = "Date";
            svg.appendChild(xLabel);
            
            const yLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
            yLabel.setAttribute("x", -innerHeight / 2);
            yLabel.setAttribute("y", 10);
            yLabel.setAttribute("transform", "rotate(-90)");
            yLabel.setAttribute("text-anchor", "middle");
            yLabel.setAttribute("fill", "#666");
            yLabel.textContent = "Cumulative XP";
            svg.appendChild(yLabel);
            
            // Add grid lines
            // Horizontal (Y) grid lines
            for (let i = 0; i <= 5; i++) {
                const y = innerHeight - (i / 5) * innerHeight;
                const gridLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
                gridLine.setAttribute("d", `M 0 ${y} H ${innerWidth}`);
                gridLine.setAttribute("stroke", "#eee");
                gridLine.setAttribute("stroke-width", "1");
                g.appendChild(gridLine);
                
                // Add Y axis labels
                const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
                label.setAttribute("x", -10);
                label.setAttribute("y", y + 4);
                label.setAttribute("text-anchor", "end");
                label.setAttribute("fill", "#666");
                label.setAttribute("font-size", "10px");
                label.textContent = Math.round((i / 5) * yMax).toLocaleString();
                g.appendChild(label);
            }
            
            // Vertical (X) grid lines
            for (let i = 0; i <= 5; i++) {
                const x = (i / 5) * innerWidth;
                const gridLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
                gridLine.setAttribute("d", `M ${x} 0 V ${innerHeight}`);
                gridLine.setAttribute("stroke", "#eee");
                gridLine.setAttribute("stroke-width", "1");
                g.appendChild(gridLine);
                
                // Add X axis labels
                const date = new Date(xExtent[0].getTime() + (i / 5) * (xExtent[1] - xExtent[0]));
                const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
                label.setAttribute("x", x);
                label.setAttribute("y", innerHeight + 15);
                label.setAttribute("text-anchor", "middle");
                label.setAttribute("fill", "#666");
                label.setAttribute("font-size", "10px");
                label.textContent = date.toLocaleDateString();
                svg.appendChild(label);
            }
        }
        
        function createProjectsChart(projects) {
            const container = document.getElementById('projects-chart');
            container.innerHTML = '';
            
            if (projects.length === 0) {
                container.innerHTML = '<p>No project data available</p>';
                return;
            }
            
            // Process data - group by project type (piscine vs regular)
            const piscineProjects = projects.filter(p => 
                p.object.name.includes('piscine') || p.path.includes('piscine'));
            const regularProjects = projects.filter(p => 
                !p.object.name.includes('piscine') && !p.path.includes('piscine'));
            
            const data = [
                { type: 'Piscine Projects', count: piscineProjects.length, avgGrade: piscineProjects.length > 0 ? 
                    piscineProjects.reduce((sum, p) => sum + p.grade, 0) / piscineProjects.length : 0 },
                { type: 'Regular Projects', count: regularProjects.length, avgGrade: regularProjects.length > 0 ? 
                    regularProjects.reduce((sum, p) => sum + p.grade, 0) / regularProjects.length : 0 }
            ];
            
            // Chart dimensions
            const width = container.clientWidth;
            const height = 400;
            const margin = { top: 20, right: 30, bottom: 80, left: 60 };
            const innerWidth = width - margin.left - margin.right;
            const innerHeight = height - margin.top - margin.bottom;
            
            // Create SVG
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", "100%");
            svg.setAttribute("height", "100%");
            svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
            container.appendChild(svg);
            
            // Create group for chart
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("transform", `translate(${margin.left},${margin.top})`);
            svg.appendChild(g);
            
            // X scale (band scale for project types)
            const xScale = (index) => (index * innerWidth / data.length) + (innerWidth / data.length / 2);
            
            // Y scale (for counts)
            const yMax = Math.max(...data.map(d => d.count));
            const yScale = (value) => innerHeight - (value / yMax) * innerHeight;
            
            // Create bars
            data.forEach((item, i) => {
                // Bar for count
                const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                bar.setAttribute("x", xScale(i) - 30);
                bar.setAttribute("y", yScale(item.count));
                bar.setAttribute("width", 60);
                bar.setAttribute("height", innerHeight - yScale(item.count));
                bar.setAttribute("fill", i === 0 ? "var(--accent)" : "var(--primary)");
                bar.setAttribute("opacity", "0.7");
                
                // Tooltip
                const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
                title.textContent = `${item.type}\nCount: ${item.count}\nAvg Grade: ${(item.avgGrade * 100).toFixed(1)}%`;
                bar.appendChild(title);
                
                g.appendChild(bar);
                
                // Text label for count
                const countLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
                countLabel.setAttribute("x", xScale(i));
                countLabel.setAttribute("y", yScale(item.count) - 5);
                countLabel.setAttribute("text-anchor", "middle");
                countLabel.setAttribute("fill", "#333");
                countLabel.textContent = item.count;
                g.appendChild(countLabel);
                
                // Text label for average grade
                const gradeLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
                gradeLabel.setAttribute("x", xScale(i));
                gradeLabel.setAttribute("y", innerHeight + 40);
                gradeLabel.setAttribute("text-anchor", "middle");
                gradeLabel.setAttribute("fill", "#666");
                gradeLabel.textContent = `Avg: ${(item.avgGrade * 100).toFixed(1)}%`;
                svg.appendChild(gradeLabel);
            });
            
            // Add X axis
            const xAxis = document.createElementNS("http://www.w3.org/2000/svg", "path");
            xAxis.setAttribute("d", `M 0 ${innerHeight} H ${innerWidth}`);
            xAxis.setAttribute("stroke", "#ccc");
            xAxis.setAttribute("stroke-width", "1");
            g.appendChild(xAxis);
            
            // Add Y axis
            const yAxis = document.createElementNS("http://www.w3.org/2000/svg", "path");
            yAxis.setAttribute("d", `M 0 0 V ${innerHeight}`);
            yAxis.setAttribute("stroke", "#ccc");
            yAxis.setAttribute("stroke-width", "1");
            g.appendChild(yAxis);
            
            // Add X axis labels (project types)
            data.forEach((item, i) => {
                const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
                label.setAttribute("x", xScale(i));
                label.setAttribute("y", innerHeight + 20);
                label.setAttribute("text-anchor", "middle");
                label.setAttribute("fill", "#666");
                label.textContent = item.type;
                svg.appendChild(label);
            });
            
            // Add Y axis label
            const yLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
            yLabel.setAttribute("x", -innerHeight / 2);
            yLabel.setAttribute("y", 10);
            yLabel.setAttribute("transform", "rotate(-90)");
            yLabel.setAttribute("text-anchor", "middle");
            yLabel.setAttribute("fill", "#666");
            yLabel.textContent = "Number of Projects";
            svg.appendChild(yLabel);
            
            // Add grid lines
            // Horizontal (Y) grid lines
            for (let i = 0; i <= 5; i++) {
                const y = innerHeight - (i / 5) * innerHeight;
                const gridLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
                gridLine.setAttribute("d", `M 0 ${y} H ${innerWidth}`);
                gridLine.setAttribute("stroke", "#eee");
                gridLine.setAttribute("stroke-width", "1");
                g.appendChild(gridLine);
                
                // Add Y axis labels
                const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
                label.setAttribute("x", -10);
                label.setAttribute("y", y + 4);
                label.setAttribute("text-anchor", "end");
                label.setAttribute("fill", "#666");
                label.setAttribute("font-size", "10px");
                label.textContent = Math.round((i / 5) * yMax);
                g.appendChild(label);
            }
        }
    