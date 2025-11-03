// استيراد المكتبات
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs/promises'); 
const path = require('path'); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// دالة لتنفيذ الكود مع الإدخال
async function executeCode(code, language, input, res) {
    let tempFileName = '';
    let executeCommand = '';
    const tempBaseName = `temp_script_${Date.now()}`;
    const timeout = 10000;
    const outputFileName = path.join(__dirname, tempBaseName);

    try {
        if (language === 'python') {
            tempFileName = path.join(__dirname, `${tempBaseName}.py`);
            await fs.writeFile(tempFileName, code);
            executeCommand = `python3 ${tempFileName}`;
        } else if (language === 'cpp') {
            tempFileName = path.join(__dirname, `${tempBaseName}.cpp`);
            
            // 1. كتابة كود C++ إلى الملف
            await fs.writeFile(tempFileName, code);
            
            // 2. أمر التجميع (Compilation): استخدام g++
            const compileCommand = `g++ ${tempFileName} -o ${outputFileName}`;
            
            // تنفيذ التجميع
            const { stderr: compileError } = await new Promise((resolve) => {
                exec(compileCommand, (error, stdout, stderr) => {
                    resolve({ error, stdout, stderr });
                });
            });
            
            if (compileError) {
                return res.json({ output: null, error: `خطأ في التجميع:\n${compileError}` });
            }

            // *** 3. الحل القطعي: تشغيل الملف المجمّع باستخدام `bash -c` لتجاوز مشكلة الأذونات ***
            executeCommand = `bash -c "./${tempBaseName}"`;
        
        } else {
            return res.status(400).json({ error: 'اللغة غير مدعومة. (تدعم: python, cpp)' });
        }

        // تنفيذ الأمر النهائي
        exec(executeCommand, { timeout: timeout, input: input }, (error, stdout, stderr) => {
            
            // 4. حذف الملفات المؤقتة
            const cleanup = async () => {
                await fs.unlink(tempFileName).catch(e => console.error("فشل حذف الملف المصدر:", e.message));
                if (language === 'cpp') {
                    fs.unlink(outputFileName).catch(e => console.error("فشل حذف الملف التنفيذي:", e.message));
                }
            };
            cleanup();
            
            // 5. إرسال النتيجة
            if (error) {
                return res.json({ output: null, error: stderr || error.message });
            }
            
            res.json({ output: stdout, error: null });
        });

    } catch (e) {
        res.status(500).json({ 
            error: `حدث خطأ داخلي في الخادم: ${e.message}`,
            details: e.message 
        });
    }
}


// --- نقطة نهاية التنفيذ (API Endpoint) ---
app.post('/execute', async (req, res) => {
    const { code, language, input } = req.body; 
    
    if (!code || !language) {
        return res.status(400).json({ error: 'الرجاء توفير الكود واللغة.' });
    }
    
    await executeCode(code, language.toLowerCase(), input || '', res);
});


// --- نقطة نهاية لعرض الواجهة الأمامية (HTML) ---
app.get('/', (req, res) => {
    const path = require('path'); 
    res.sendFile(path.join(__dirname, 'index.html'));
});


// --- تشغيل الخادم ---
app.listen(PORT, () => {
    console.log(`\n🎉 الخادم جاهز ويعمل على المنفذ: http://localhost:${PORT}`);
});