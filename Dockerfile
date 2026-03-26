FROM registry.access.redhat.com/ubi10/nodejs-24-minimal
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
EXPOSE 8080
CMD ["node", "dist/index.js", "--transport", "http"]
