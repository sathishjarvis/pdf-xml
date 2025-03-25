document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('fileInput');
    const dropArea = document.getElementById('dropArea');
    const convertBtn = document.getElementById('convertBtn');
    const outputArea = document.getElementById('outputArea');
    const xmlOutput = document.getElementById('xmlOutput');
    const downloadBtn = document.getElementById('downloadBtn');
    const copyBtn = document.getElementById('copyBtn');
    const statusDiv = document.getElementById('status');
    
    let pdfFile = null;
    
    // Set PDF.js worker path
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';
    
    // Drag and drop functionality
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropArea.classList.add('highlight');
    }
    
    function unhighlight() {
        dropArea.classList.remove('highlight');
    }
    
    dropArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0 && files[0].type === 'application/pdf') {
            handleFiles(files);
        } else {
            showStatus('Please upload a PDF file', 'error');
        }
    }
    
    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            handleFiles(this.files);
        }
    });
    
    function handleFiles(files) {
        pdfFile = files[0];
        convertBtn.disabled = false;
        showStatus(`File ready: ${pdfFile.name}`, 'success');
    }
    
    convertBtn.addEventListener('click', convertPdfToXml);
    
    async function convertPdfToXml() {
        if (!pdfFile) return;
        
        showStatus('Processing PDF...', '');
        convertBtn.disabled = true;
        
        try {
            const arrayBuffer = await readFileAsArrayBuffer(pdfFile);
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<pdf>\n';
            xmlContent += `  <metadata>\n    <filename>${escapeXml(pdfFile.name)}</filename>\n    <pages>${pdf.numPages}</pages>\n  </metadata>\n`;
            
            // Process each page
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                
                xmlContent += `  <page number="${i}">\n`;
                
                // Process text items
                textContent.items.forEach((item, index) => {
                    xmlContent += `    <textItem id="${index}" x="${item.transform[4]}" y="${item.transform[5]}">\n`;
                    xmlContent += `      ${escapeXml(item.str)}\n`;
                    xmlContent += '    </textItem>\n';
                });
                
                xmlContent += '  </page>\n';
            }
            
            xmlContent += '</pdf>';
            
            // Display the XML
            xmlOutput.textContent = formatXml(xmlContent);
            outputArea.style.display = 'block';
            showStatus('Conversion successful!', 'success');
        } catch (error) {
            console.error('Error converting PDF:', error);
            showStatus('Error converting PDF: ' + error.message, 'error');
        } finally {
            convertBtn.disabled = false;
        }
    }
    
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
    
    function escapeXml(unsafe) {
        return unsafe.replace(/[<>&'"]/g, function(c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    }
    
    function formatXml(xml) {
        const PADDING = ' '.repeat(2);
        const reg = /(>)(<)(\/*)/g;
        let pad = 0;
        
        xml = xml.replace(reg, '$1\r\n$2$3');
        
        return xml.split('\r\n').map(node => {
            let indent = 0;
            if (node.match(/.+<\/\w[^>]*>$/)) {
                indent = 0;
            } else if (node.match(/^<\/\w/)) {
                if (pad !== 0) pad -= 1;
            } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
                indent = 1;
            } else {
                indent = 0;
            }
            
            pad += indent;
            return PADDING.repeat(pad - indent) + node;
        }).join('\r\n');
    }
    
    downloadBtn.addEventListener('click', function() {
        if (!xmlOutput.textContent) return;
        
        const blob = new Blob([xmlOutput.textContent], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = pdfFile.name.replace('.pdf', '.xml') || 'converted.xml';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    
    copyBtn.addEventListener('click', function() {
        if (!xmlOutput.textContent) return;
        
        navigator.clipboard.writeText(xmlOutput.textContent)
            .then(() => showStatus('XML copied to clipboard!', 'success'))
            .catch(err => showStatus('Failed to copy: ' + err, 'error'));
    });
    
    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = 'status ' + type;
    }
});