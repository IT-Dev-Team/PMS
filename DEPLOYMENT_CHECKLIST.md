# Deployment Checklist

Complete this checklist before deploying EIH AI Assistant to production.

## Pre-Deployment

### Code Quality
- [ ] All TypeScript errors resolved
- [ ] No console.log([v0]...) debug statements
- [ ] Code linting passes (`pnpm lint`)
- [ ] No security vulnerabilities (`npm audit`)
- [ ] All imports are used

### Testing
- [ ] Tested locally: `pnpm dev`
- [ ] Chat functionality works
- [ ] File upload works with all formats
- [ ] Voice input captures correctly
- [ ] Voice output (if enabled) works
- [ ] Chat history persists in session
- [ ] Login/logout works

### Configuration
- [ ] `.env.local` file has all required keys
- [ ] No secrets committed to git
- [ ] `NEXT_PUBLIC_DEEPSEEK_API_KEY` is valid
- [ ] Environment variables documented
- [ ] `.gitignore` includes `.env*` files

## Vercel Setup

### Project Configuration
- [ ] GitHub repository connected to Vercel
- [ ] Project created in Vercel dashboard
- [ ] Node version set to 18+ (if needed)
- [ ] Build command: `pnpm build`
- [ ] Start command: `pnpm start`

### Environment Variables
- [ ] `NEXT_PUBLIC_DEEPSEEK_API_KEY` set
- [ ] `NEXTAUTH_SECRET` generated and set
- [ ] (If using Microsoft Auth):
  - [ ] `MICROSOFT_CLIENT_ID` set
  - [ ] `MICROSOFT_CLIENT_SECRET` set
  - [ ] `MICROSOFT_TENANT_ID` set
  - [ ] `NEXTAUTH_URL` set to production domain

### Domain Configuration
- [ ] Custom domain assigned (if applicable)
- [ ] SSL/TLS enabled
- [ ] DNS records updated
- [ ] Redirect URLs updated in Azure (if using OAuth)

## Azure AD Configuration (If Using Microsoft Auth)

### Application Registration
- [ ] Application registered in Azure Portal
- [ ] Client ID and Secret securely stored
- [ ] Tenant ID noted
- [ ] API permissions configured

### Redirect URIs
- [ ] Added: `https://yourdomain.com/api/auth/callback/azure-ad`
- [ ] Removed: localhost URLs (for production)
- [ ] Protocol: HTTPS (not HTTP)

### Certificates
- [ ] Client secret created and not expired
- [ ] Backup secrets created for rotation
- [ ] Expiration date noted in calendar

## Security Checklist

### Code Security
- [ ] No hardcoded credentials
- [ ] Input validation implemented
- [ ] CORS headers configured
- [ ] Rate limiting considered
- [ ] SQL injection protections (if using DB)

### API Security
- [ ] API keys stored in environment variables
- [ ] DeepSeek API key has minimal permissions
- [ ] Error messages don't leak sensitive info
- [ ] Timeouts configured for API calls

### User Security
- [ ] Password hashing implemented (if custom auth)
- [ ] Session tokens secure (HTTPOnly, Secure flags)
- [ ] CSRF protection enabled
- [ ] XSS protection enabled

### Data Security
- [ ] Data encryption in transit (HTTPS)
- [ ] User data collection minimized
- [ ] Privacy policy updated
- [ ] Data retention policy defined

## Performance

### Optimization
- [ ] Images optimized (using next/image)
- [ ] Code splitting working
- [ ] API responses cached where appropriate
- [ ] Database queries optimized (if using DB)

### Monitoring
- [ ] Error tracking set up (Sentry, etc.)
- [ ] Performance monitoring enabled
- [ ] Analytics configured
- [ ] Logs accessible

## Testing in Production

### Functionality Testing
- [ ] Sign in works
- [ ] Chat sends messages
- [ ] Files upload correctly
- [ ] Voice features work
- [ ] Sign out functions properly
- [ ] Error handling works

### Cross-Browser Testing
- [ ] Chrome/Edge ✓
- [ ] Firefox ✓
- [ ] Safari ✓
- [ ] Mobile browsers ✓

### Responsive Design
- [ ] Desktop layout correct
- [ ] Tablet layout correct
- [ ] Mobile layout correct
- [ ] Touch interactions work

## Documentation

### Setup Docs
- [ ] SETUP.md updated with production info
- [ ] MICROSOFT_AUTH_SETUP.md complete (if applicable)
- [ ] USER_GUIDE.md accurate
- [ ] README created/updated

### Deployment Docs
- [ ] Deployment process documented
- [ ] Rollback procedure documented
- [ ] Monitoring setup documented
- [ ] Support contact info included

## Monitoring & Maintenance

### Monitoring Setup
- [ ] Error alerts configured
- [ ] Performance alerts configured
- [ ] API rate limit alerts set
- [ ] Uptime monitoring enabled

### Regular Checks
- [ ] Check error logs daily (1st week)
- [ ] Monitor API usage
- [ ] Review user feedback
- [ ] Plan for backups

### Maintenance Schedule
- [ ] Weekly: Review logs
- [ ] Monthly: Security updates
- [ ] Quarterly: Feature review
- [ ] Annually: Security audit

## Post-Deployment

### Announcement
- [ ] Team notified of launch
- [ ] Documentation shared
- [ ] User training completed
- [ ] Feedback channel established

### Monitoring (First 24 Hours)
- [ ] Check error logs hourly
- [ ] Monitor API response times
- [ ] Watch user feedback
- [ ] Be ready for quick fixes

### Weekly Review (First Month)
- [ ] Analyze error patterns
- [ ] Review performance metrics
- [ ] Check user feedback
- [ ] Plan improvements

## Rollback Plan

If issues occur in production:

1. **Identify Issue**: Check error logs and monitoring
2. **Assess Impact**: How many users affected?
3. **Quick Fix**: Can it be fixed with config change?
4. **Rollback**: Revert to previous version if needed
   ```bash
   vercel rollback
   ```
5. **Communicate**: Notify stakeholders
6. **Post-Mortem**: Review what happened

## Scaling Considerations

As usage grows:

- [ ] Database connection pooling (if using DB)
- [ ] API rate limiting implemented
- [ ] Caching strategy optimized
- [ ] Load testing completed
- [ ] Auto-scaling configured

## Compliance Checklist

- [ ] GDPR compliance (if serving EU users)
- [ ] Data privacy policy created
- [ ] Terms of service defined
- [ ] Cookie consent implemented (if needed)
- [ ] Accessibility standards met (WCAG 2.1 AA)

## Success Criteria

Production deployment is successful when:

✅ Zero critical errors in first 24 hours
✅ Response times < 2 seconds average
✅ API rate limits not exceeded
✅ All features functional
✅ Users report positive experience

---

## Sign-Off

- [ ] Product Owner: _________________ Date: _______
- [ ] Tech Lead: _________________ Date: _______
- [ ] QA Lead: _________________ Date: _______

---

**Deployment Date**: ________________
**Deployment Time**: ________________
**Deployed By**: ________________
**Production URL**: ________________

---

If you encounter any issues, check the troubleshooting sections in:
- SETUP.md
- MICROSOFT_AUTH_SETUP.md
- USER_GUIDE.md
