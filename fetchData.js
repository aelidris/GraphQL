fetch("https://learn.zone01oujda.ma/api/graphql-engine/v1/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyMTMyIiwiaWF0IjoxNzQ0MDQyMzE5LCJpcCI6IjE3Mi4xOC4wLjIiLCJleHAiOjE3NDQxMjg3MTksImh0dHBzOi8vaGFzdXJhLmlvL2p3dC9jbGFpbXMiOnsieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJ1c2VyIl0sIngtaGFzdXJhLWNhbXB1c2VzIjoie30iLCJ4LWhhc3VyYS1kZWZhdWx0LXJvbGUiOiJ1c2VyIiwieC1oYXN1cmEtdXNlci1pZCI6IjIxMzIiLCJ4LWhhc3VyYS10b2tlbi1pZCI6ImRmNGZkNmJkLWYxYjgtNGJjNy05ZDQzLWM4N2UyNWJlNDE5NSJ9fQ.IdFOGh2WxEKVcZCB6ulQJsyeF1ulND4mlA4u_sWESXg" // If required
    },
    body: JSON.stringify({
      query: `
        query {
          user {
            id
            login
            email
            # Add other fields you need for the profile
          }
        }
      `
    })
  })
  .then(res => res.json())
  .then(data => console.log(data));