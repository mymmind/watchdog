/**
 * SSL Certificate health checker
 * Checks SSL certificate expiry dates and warns before expiration
 */

import https from 'https';
import { URL } from 'url';
import HealthChecker from './HealthChecker.js';
import logger from '../utils/logger.js';

export default class SSLChecker extends HealthChecker {
  /**
   * Check SSL certificate expiry
   * @param {Object} service - Service object with URL
   * @returns {Promise<HealthCheckResult>}
   */
  async check(service) {
    const startTime = Date.now();
    const { url } = service;
    const threshold = this.config.thresholds?.sslDays || 14;

    try {
      const certInfo = await this.getCertificateInfo(url);

      if (!certInfo) {
        return this.createFailureResult(
          Date.now() - startTime,
          'Could not retrieve SSL certificate',
        );
      }

      const { validTo, daysRemaining } = certInfo;

      // Check if certificate is expired
      if (daysRemaining < 0) {
        return this.createFailureResult(
          Date.now() - startTime,
          `Certificate expired ${Math.abs(daysRemaining)} days ago`,
          { validTo, daysRemaining, expired: true },
        );
      }

      // Check if certificate is expiring soon
      if (daysRemaining <= threshold) {
        return this.createFailureResult(
          Date.now() - startTime,
          `Certificate expires in ${daysRemaining} days (threshold: ${threshold} days)`,
          { validTo, daysRemaining, threshold },
        );
      }

      // Certificate is valid and not expiring soon
      return this.createSuccessResult(Date.now() - startTime, {
        validTo,
        daysRemaining,
        threshold,
      });
    } catch (error) {
      logger.error(`SSL check failed for ${url}`, { error: error.message });
      return this.createFailureResult(
        Date.now() - startTime,
        error.message,
      );
    }
  }

  /**
   * Get certificate information from a URL
   * @param {string} urlString - URL to check
   * @returns {Promise<Object>}
   */
  async getCertificateInfo(urlString) {
    return new Promise((resolve, reject) => {
      try {
        const parsedUrl = new URL(urlString);

        // Only works with HTTPS URLs
        if (parsedUrl.protocol !== 'https:') {
          reject(new Error('URL must use HTTPS protocol'));
          return;
        }

        const options = {
          host: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          method: 'GET',
          rejectUnauthorized: false, // Accept self-signed certs for checking
        };

        const req = https.request(options, (res) => {
          const cert = res.socket.getPeerCertificate();

          if (!cert || Object.keys(cert).length === 0) {
            reject(new Error('No certificate found'));
            return;
          }

          const validTo = new Date(cert.valid_to);
          const now = new Date();
          const daysRemaining = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

          resolve({
            validFrom: new Date(cert.valid_from),
            validTo,
            daysRemaining,
            issuer: cert.issuer,
            subject: cert.subject,
          });

          res.socket.end();
        });

        req.on('error', (error) => {
          reject(error);
        });

        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('SSL certificate check timeout'));
        });

        req.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Check multiple domains and return summary
   * @param {Array<string>} urls - URLs to check
   * @returns {Promise<Object>}
   */
  async checkMultiple(urls) {
    const results = await Promise.all(
      urls.map(async (url) => {
        const result = await this.check({ url });
        return { url, ...result };
      }),
    );

    const expiringSoon = results.filter(
      (r) => !r.healthy && r.metadata?.daysRemaining >= 0,
    );
    const expired = results.filter(
      (r) => !r.healthy && r.metadata?.expired,
    );
    const valid = results.filter((r) => r.healthy);

    return {
      results,
      summary: {
        total: results.length,
        valid: valid.length,
        expiringSoon: expiringSoon.length,
        expired: expired.length,
      },
    };
  }
}
