// استيراد المكتبات
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs/promises'); 
const path = require('path');

const app = express();
// استخدام منفذ Render (PORT)
const PORT = process.env.PORT || 3000;

// --- الإعدادات الوسيطة (Middleware) ---
app.use(cors());
app.use(express.json());

// دالة لتنفيذ الكود مع الإدخال
async function executeCode(code, language, input, res) {
    let tempFileName = '';
    let executeCommand = '';
    const tempBaseName = `temp_script_${Date.now()}`;
    const timeout = 10000; // 10 ثواني كحد أقصى للتنفيذ

    try {
        if (language === 'python') {
            tempFileName = path.join(__dirname, `${tempBaseName}.py`);
            await fs.writeFile(tempFileName, code);
            executeCommand = `python3 ${tempFileName}`;
        } else if (language === 'cpp') {
            // مسارات لملفات C++
            tempFileName = path.join(__dirname, `${tempBaseName}.cpp`);
            const outputFileName = path.join(__dirname, tempBaseName); 
            
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
                // فشل التجميع
                return res.json({ output: null, error: `خطأ في التجميع:\n${compileError}` });
            }

            // 3. أمر التنفيذ (Execution)
            // *** تم التعديل هنا لضمان التنفيذ في Docker ***
            executeCommand = `./${tempBaseName}`; 
        
        } else {
            return res.status(400).json({ error: 'اللغة غير مدعومة. (تدعم: python, cpp)' });
        }

        // تنفيذ الأمر النهائي (Python أو C++ المجمّع)
        // يتم تمرير الإدخال (input) إلى البرنامج عبر `input` في options
        exec(executeCommand, { timeout: timeout, input: input }, (error, stdout, stderr) => {
            
            // 4. حذف الملفات المؤقتة
            const cleanup = async () => {
                if (language === 'python') {
                    await fs.unlink(tempFileName).catch(e => console.error("فشل حذف ملف Python المؤقت:", e.message));
                } else if (language === 'cpp') {
                    const outputFileName = path.join(__dirname, tempBaseName);
                    await fs.unlink(tempFileName).catch(e => console.error("فشل حذف ملف C++ المصدر:", e.message));
                    fs.unlink(outputFileName).catch(e => console.error("فشل حذف ملف C++ التنفيذي:", e.message));
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
            error: 'حدث خطأ غير متوقع في الخادم أثناء محاولة تشغيل الكود.',
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


// --- تشغيل الخادم ---
app.listen(PORT, () => {
    console.log(`\n🎉 الخادم جاهز ويعمل على المنفذ: http://localhost:${PORT}`);
});