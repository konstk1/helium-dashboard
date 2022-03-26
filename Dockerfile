FROM node:17-alpine

WORKDIR /app
COPY ["package.json", "package-lock.json*", "./"]

RUN npm install --include=dev --production
COPY . .

RUN echo "*/30 * * * * /usr/local/bin/node /app/test/test_lambda.js >> /dev/stdout 2>&1" > /etc/cronjob && chmod +x /etc/cronjob
RUN crontab /etc/cronjob

# Testing
#CMD ["/usr/local/bin/node", "/app/test/test_lambda.js"]

# Cronjob execution
CMD ["crond", "-f"]
