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

// دالة لتنفيذ الكود
async function executeCode(code, language, res) {
    let tempFileName = '';
    let executeCommand = '';
    const tempBaseName = `temp_script_${Date.now()}`;
    const timeout = 10000; // 10 ثواني كحد أقصى للتنفيذ

    try {
        if (language === 'python') {
            tempFileName = path.join(__dirname, `${tempBaseName}.py`);
            await fs.writeFile(tempFileName, code);
            executeCommand = `python3 ${tempFileName}`; // استخدام python3 لضمان التوافق على Render
        } else if (language === 'cpp') {
            // مسارات لملفات C++
            tempFileName = path.join(__dirname, `${tempBaseName}.cpp`);
            const outputFileName = path.join(__dirname, tempBaseName); // اسم الملف الناتج بعد التجميع
            
            // 1. كتابة كود C++ إلى الملف
            await fs.writeFile(tempFileName, code);
            
            // 2. أمر التجميع (Compilation): استخدام g++
            const compileCommand = `g++ ${tempFileName} -o ${outputFileName}`;
            
            console.log(`[LOG] بدء تجميع C++: ${tempFileName}`);

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
            executeCommand = `${outputFileName}`; 
        
        } else {
            return res.status(400).json({ error: 'اللغة غير مدعومة. (تدعم: python, cpp)' });
        }

        // تنفيذ الأمر النهائي (Python أو C++ المجمّع)
        exec(executeCommand, { timeout: timeout }, (error, stdout, stderr) => {
            
            // 4. حذف الملفات المؤقتة
            const cleanup = async () => {
                if (language === 'python') {
                    await fs.unlink(tempFileName).catch(e => console.error("فشل حذف ملف Python المؤقت:", e.message));
                } else if (language === 'cpp') {
                    // حذف ملف الكود المصدر (cpp) وملف التنفيذ (ملف التنفيذ)
                    const outputFileName = path.join(__dirname, tempBaseName);
                    await fs.unlink(tempFileName).catch(e => console.error("فشل حذف ملف C++ المصدر:", e.message));
                    fs.unlink(outputFileName).catch(e => console.error("فشل حذف ملف C++ التنفيذي:", e.message));
                }
            };
            cleanup();
            
            // 5. إرسال النتيجة
            if (error) {
                // حدث خطأ في التنفيذ (Runtime Error)
                console.error('[EXEC ERROR]:', stderr || error.message);
                return res.json({ output: null, error: stderr || error.message });
            }
            
            console.log('[LOG] تم التنفيذ بنجاح.');
            res.json({ output: stdout, error: null });
        });

    } catch (e) {
        // 6. التعامل مع أخطاء الخادم الداخلية (مثل مشاكل الكتابة على القرص)
        console.error('[SERVER ERROR]:', e);
        res.status(500).json({ 
            error: 'حدث خطأ غير متوقع في الخادم أثناء محاولة تشغيل الكود.',
            details: e.message 
        });
    }
}


// --- نقطة نهاية التنفيذ (API Endpoint) ---
app.post('/execute', async (req, res) => {
    const { code, language } = req.body;

    if (!code || !language) {
        return res.status(400).json({ error: 'الرجاء توفير الكود واللغة.' });
    }
    
    // تمرير عملية التنفيذ إلى الدالة الرئيسية
    await executeCode(code, language.toLowerCase(), res);
});


// --- تشغيل الخادم ---
app.listen(PORT, () => {
    console.log(`\n🎉 الخادم جاهز ويعمل على المنفذ: http://localhost:${PORT}`);
    console.log('ملاحظة: تأكد من أن أمر "python3" و "g++" يعملان في الطرفية قبل النشر.');
});