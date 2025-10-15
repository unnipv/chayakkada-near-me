# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Chayakkada Near Me, please report it responsibly:

1. **DO NOT** open a public GitHub issue
2. Email the maintainers directly with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to address the issue.

## Security Measures

### Authentication
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens with secure secrets
- HttpOnly cookies for token storage
- Session expiration (7 days)

### API Security
- Rate limiting on all endpoints
- Input validation with express-validator
- SQL injection protection (parameterized queries only)
- XSS protection via Helmet.js
- CORS configuration for production
- HPP (HTTP Parameter Pollution) protection
- MongoDB sanitization

### Data Protection
- Environment variables for secrets
- API keys never exposed to frontend
- Backend proxy for Google Maps API
- Database credentials in environment only
- No sensitive data in logs

### Production Checklist

Before deploying to production:

1. **Environment Variables**
   - [ ] Strong JWT_SECRET (minimum 32 characters)
   - [ ] Restricted Google Maps API key
   - [ ] DATABASE_URL with SSL enabled
   - [ ] NODE_ENV set to 'production'
   - [ ] ALLOWED_ORIGINS configured

2. **Google Maps API Restrictions**
   - [ ] HTTP referrer restrictions enabled
   - [ ] API restrictions (only enable required APIs)
   - [ ] Usage quotas set
   - [ ] Billing alerts configured

3. **Database Security**
   - [ ] Strong database password
   - [ ] SSL/TLS connection enforced
   - [ ] Regular backups configured
   - [ ] Limited user permissions
   - [ ] No public access

4. **Server Security**
   - [ ] HTTPS enabled
   - [ ] Security headers configured (Helmet.js)
   - [ ] Rate limiting adjusted for traffic
   - [ ] Error messages don't expose internals
   - [ ] Logs don't contain sensitive data

5. **Code Review**
   - [ ] No hardcoded secrets
   - [ ] All inputs validated
   - [ ] SQL queries parameterized
   - [ ] Dependencies updated
   - [ ] Security audit run

## Secure Development Practices

### For Contributors

1. **Never commit secrets**
   - Use `.env` for local development
   - Add sensitive files to `.gitignore`
   - Use `.env.example` as template

2. **Validate all inputs**
   - Use express-validator for all user inputs
   - Sanitize data before database operations
   - Validate file uploads (if added)

3. **Use parameterized queries**
   ```javascript
   // Good
   pool.query('SELECT * FROM users WHERE id = $1', [userId])

   // Bad
   pool.query(`SELECT * FROM users WHERE id = ${userId}`)
   ```

4. **Don't log sensitive data**
   - Never log passwords
   - Mask API keys in logs
   - Don't log full request bodies

5. **Keep dependencies updated**
   ```bash
   npm audit
   npm audit fix
   ```

## Known Security Considerations

### Rate Limiting
Default rate limits are set conservatively. Adjust based on your needs:
- Auth endpoints: 5 requests/15 minutes
- Search endpoints: 20 requests/minute
- API endpoints: 100 requests/15 minutes

### API Costs
Google Maps API calls cost money. Monitor usage:
- Places Autocomplete: $2.83 per 1,000 requests
- Places Details: $17 per 1,000 requests
- Distance Matrix: $5-10 per 1,000 elements
- Geocoding: $5 per 1,000 requests

Set billing alerts and quotas in Google Cloud Console.

### Database Access
PostgreSQL connections are pooled. Default settings:
- Max connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 10 seconds

Adjust based on your traffic and database capacity.

## Security Updates

We take security seriously. Security updates will be:
- Released as soon as possible
- Announced in release notes
- Tagged with severity level
- Include migration instructions if needed

## Compliance

This application:
- Does not collect personal information beyond username
- Does not use cookies for tracking
- Stores minimal user data
- Allows anonymous contributions
- Does not share data with third parties (except Google Maps for location services)

## Contact

For security concerns, contact the maintainers at:
- GitHub: [Open a private security advisory](https://github.com/YOUR_USERNAME/chayakkada-near-me/security/advisories/new)

---

Last updated: 2025-01-15
