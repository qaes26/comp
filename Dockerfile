# استخدام بيئة Debian كأساس، والتي تحتوي على الأدوات التي نحتاجها
FROM debian:latest

# تثبيت Node.js و npm و Python و g++
RUN apt-get update && \
    apt-get install -y nodejs npm python3 g++ && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    rm -rf /var/lib/apt/lists/*

# تعيين مجلد العمل داخل الحاوية
WORKDIR /usr/src/app

# نسخ ملفات الإعدادات وتثبيت حزم Node.js
COPY package*.json ./
RUN npm install

# نسخ باقي ملفات المشروع إلى مجلد العمل
COPY . .

# المنفذ الذي يستمع عليه تطبيق Node.js (يجب أن يطابق ما في server.js)
EXPOSE 3000

# الأمر الذي يبدأ به الخادم
CMD ["npm", "start"]