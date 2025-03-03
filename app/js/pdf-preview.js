// PDF Preview functionality
document.addEventListener('DOMContentLoaded', () => {
    const downloadPDFButton = document.getElementById('downloadPDF');
    const pdfPreview = document.getElementById('pdfPreview');

    if (downloadPDFButton) {
        downloadPDFButton.addEventListener('click', async () => {
            try {
                // Show loading state
                pdfPreview.innerHTML = '<div class="text-center p-4"><i class="fas fa-spinner fa-spin"></i> Generating PDF...</div>';

                // Generate PDF
                const result = await window.characterStorage.generatePDF(currentCharacter);

                if (result.success) {
                    // Create an iframe to display the PDF
                    const iframe = document.createElement('iframe');
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                    iframe.style.border = 'none';

                    // Convert the file path to a URL that can be used in the iframe
                    const pdfUrl = `file://${result.filePath}`;
                    iframe.src = pdfUrl;

                    // Clear the preview container and add the iframe
                    pdfPreview.innerHTML = '';
                    pdfPreview.appendChild(iframe);

                    // Show success message
                    const successMessage = document.createElement('div');
                    successMessage.className = 'alert alert-success mt-3';
                    successMessage.innerHTML = `
                        <i class="fas fa-check-circle"></i> 
                        PDF generated successfully! 
                        <button class="btn btn-sm btn-outline-success ms-2" onclick="window.characterStorage.openFile('${result.filePath}')">
                            <i class="fas fa-external-link-alt"></i> Open File
                        </button>
                    `;
                    pdfPreview.insertBefore(successMessage, iframe);
                } else {
                    throw new Error(result.error || 'Failed to generate PDF');
                }
            } catch (error) {
                console.error('Error generating PDF:', error);
                pdfPreview.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-circle"></i> 
                        Error generating PDF: ${error.message}
                    </div>
                `;
            }
        });
    }
}); 