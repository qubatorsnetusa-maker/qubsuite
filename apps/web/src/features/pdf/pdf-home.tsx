import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  FileText,
  Upload,
  PenTool,
  Type,
  Image as ImageIcon,
  HardDrive,
  Clock,
  
  CheckCircle2,
  FileCheck,
  Search,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { driveService } from '@/services/drive';
import { getServiceUrl } from '@/lib/ecosystem-urls';
import { PdfStudio } from './pdf-studio';
import { cn } from '@/lib/utils';

export function PdfHome() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Active studio session state
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);
  const [activePdfName, setActivePdfName] = useState<string>('Document.pdf');
  const [search, setSearch] = useState('');

  // Fetch recent PDF files from Drive
  const { data: driveFiles, isLoading } = useQuery({
    queryKey: ['drive', 'recent', 'pdf'],
    queryFn: async () => {
      try {
        const res = await driveService.recent({ limit: 20 });
        const items = res.items || [];
        return items.filter(
          (item: any) =>
            item.mimeType === 'application/pdf' ||
            item.name?.toLowerCase().endsWith('.pdf') ||
            item.fileType === 'PDF'
        );
      } catch {
        return [];
      }
    },
  });

  // Open file from local device
  const handleFileSelected = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      toast.error('Please choose a valid PDF document.');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setActivePdfUrl(objectUrl);
    setActivePdfName(file.name);
    toast.success(`Loaded "${file.name}" into PDF Studio`);
  };

  // Generate an instant in-memory sample agreement for testing
  const handleOpenSampleDocument = async () => {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]); // Standard US Letter
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Header Banner
      page.drawRectangle({
        x: 0,
        y: 720,
        width: 612,
        height: 72,
        color: rgb(0.9, 0.15, 0.2),
      });

      page.drawText('QUBSUITE ENTERPRISE SERVICES AGREEMENT', {
        x: 50,
        y: 748,
        size: 15,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });

      page.drawText('Confidential & Legally Binding Agreement', {
        x: 50,
        y: 732,
        size: 10,
        font: helvetica,
        color: rgb(0.95, 0.95, 0.95),
      });

      // Body text
      page.drawText('1. PARTIES & ENGAGEMENT', {
        x: 50,
        y: 670,
        size: 12,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.2),
      });

      page.drawText(
        'This agreement is entered into between QubDocs Corporation ("Provider") and the designated\nClient for enterprise document management, cloud storage, real-time collaboration, and security.',
        {
          x: 50,
          y: 645,
          size: 10,
          font: helvetica,
          lineHeight: 15,
          color: rgb(0.2, 0.2, 0.3),
        }
      );

      page.drawText('2. DIGITAL EXECUTION & SIGNATURE TERMS', {
        x: 50,
        y: 580,
        size: 12,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.2),
      });

      page.drawText(
        'The parties agree that electronic signatures, digital seals, and typed text marks executed within\nQub PDF shall constitute valid, original signatures having full legal force and enforceability.',
        {
          x: 50,
          y: 555,
          size: 10,
          font: helvetica,
          lineHeight: 15,
          color: rgb(0.2, 0.2, 0.3),
        }
      );

      // Signature Execution Block
      page.drawRectangle({
        x: 50,
        y: 250,
        width: 512,
        height: 220,
        borderColor: rgb(0.8, 0.82, 0.88),
        borderWidth: 1,
        color: rgb(0.98, 0.99, 1.0),
      });

      page.drawText('SIGNATURE & ACCEPTANCE BLOCK', {
        x: 70,
        y: 440,
        size: 11,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.3),
      });

      // Left column: Provider
      page.drawText('PROVIDER: QubDocs Corp', {
        x: 70,
        y: 405,
        size: 10,
        font: helveticaBold,
        color: rgb(0.2, 0.2, 0.3),
      });
      page.drawLine({
        start: { x: 70, y: 340 },
        end: { x: 260, y: 340 },
        thickness: 1,
        color: rgb(0.7, 0.7, 0.7),
      });
      page.drawText('Authorized Signature (QubDocs)', {
        x: 70,
        y: 325,
        size: 9,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
      page.drawText('Date: ' + new Date().toLocaleDateString(), {
        x: 70,
        y: 300,
        size: 9,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      });

      // Right column: Client (For user to sign)
      page.drawText('CLIENT / RECIPIENT:', {
        x: 310,
        y: 405,
        size: 10,
        font: helveticaBold,
        color: rgb(0.2, 0.2, 0.3),
      });
      page.drawLine({
        start: { x: 310, y: 340 },
        end: { x: 510, y: 340 },
        thickness: 1,
        color: rgb(0.7, 0.7, 0.7),
      });
      page.drawText('Sign here with mouse, finger, or image', {
        x: 310,
        y: 325,
        size: 9,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
      page.drawText('Date: [Click Date to stamp]', {
        x: 310,
        y: 300,
        size: 9,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      });

      // Footer
      page.drawText('Page 1 of 1 • Generated for Qub PDF Studio • Verified Electronic Record', {
        x: 50,
        y: 35,
        size: 8,
        font: helvetica,
        color: rgb(0.6, 0.6, 0.6),
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);
      setActivePdfUrl(objectUrl);
      setActivePdfName('Sample_Services_Agreement.pdf');
      toast.success('Sample agreement loaded into PDF Studio.');
    } catch (err) {
      console.error('Failed to create sample PDF:', err);
      toast.error('Could not generate sample document.');
    }
  };

  // Open an existing PDF from Drive
  const handleOpenDrivePdf = (item: any) => {
    const url = driveService.contentUrl(item.id);
    setActivePdfUrl(url);
    setActivePdfName(item.name);
  };

  // If Studio is active, render full PDF Studio interface
  if (activePdfUrl) {
    return (
      <PdfStudio
        pdfUrl={activePdfUrl}
        fileName={activePdfName}
        onBack={() => {
          URL.revokeObjectURL(activePdfUrl);
          setActivePdfUrl(null);
        }}
        onSaveToDrive={(blob, fileName) => {
          const file = new File([blob], fileName, { type: 'application/pdf' });
          void driveService.upload(file, undefined).then(() => {
            toast.success(`Saved "${fileName}" to Qub Drive.`);
          });
        }}
      />
    );
  }

  // Filtered recent PDFs
  const filteredFiles = (driveFiles || []).filter((f: any) =>
    f.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-surface-1 flex flex-col text-foreground">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelected(file);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Top Acrobat-Grade App Header */}
      <header className="h-16 border-b border-border bg-surface-2 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <a
            href={getServiceUrl('drive', '/drive')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-hover transition-colors text-xs font-medium border border-border/60"
            title="Switch to Qub Drive"
          >
            <HardDrive className="size-4 text-blue-600" />
            <span className="hidden sm:inline">Qub Drive</span>
          </a>
          <div className="h-5 w-px bg-border/80 mx-1 hidden sm:block" />
          <div className="p-2 rounded-xl bg-red-600 text-white shadow-md shadow-red-600/20">
            <FileText className="size-5 font-bold" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-none">Qub PDF</h1>
            <p className="text-xs text-muted mt-0.5">All-in-one PDF Editor & Signature Studio</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-64 hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PDF files..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-border bg-surface-1 focus:outline-none focus:border-red-500"
          />
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 gap-1.5 shadow-md shadow-red-600/20"
          >
            <Upload className="size-4" />
            <span>Select PDF</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-10">
        {/* Hero Dropzone Card */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) handleFileSelected(file);
          }}
          className="rounded-2xl border-2 border-dashed border-red-500/40 bg-gradient-to-br from-red-500/10 via-surface-2 to-surface-1 p-8 md:p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm hover:border-red-500 transition-all"
        >
          <div className="size-16 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-xl shadow-red-600/30">
            <FileText className="size-8" />
          </div>

          <div className="max-w-md space-y-1.5">
            <h2 className="text-xl font-bold text-foreground">
              Drop your PDF here to edit, fill & sign
            </h2>
            <p className="text-xs text-muted">
              Add borderless inline text, signatures, seals, images, checkmarks, and export flattened PDFs ready for legal execution.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-5 py-2.5 shadow-lg shadow-red-600/30 gap-2"
            >
              <Upload className="size-4" />
              <span>Upload PDF Document</span>
            </Button>
            <Button
              variant="outline"
              onClick={handleOpenSampleDocument}
              className="border-border text-xs font-semibold px-4 py-2.5 gap-2"
            >
              <FileText className="size-3.5 text-blue-500" />
              <span>Try Sample Agreement</span>
            </Button>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-2">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-500 w-fit">
              <Type className="size-4" />
            </div>
            <h3 className="font-semibold text-sm">Seamless Borderless Text</h3>
            <p className="text-xs text-muted leading-relaxed">
              Click anywhere to add clean text without any bounding box lines or form cards.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-2">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-500 w-fit">
              <PenTool className="size-4" />
            </div>
            <h3 className="font-semibold text-sm">Draw, Type & Sign</h3>
            <p className="text-xs text-muted leading-relaxed">
              Draw smooth signatures or generate elegant cursive script signatures in legal blue or black ink.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-2">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-500 w-fit">
              <ImageIcon className="size-4" />
            </div>
            <h3 className="font-semibold text-sm">Import Signature Images</h3>
            <p className="text-xs text-muted leading-relaxed">
              Upload photos or transparent PNGs of your signature, stamp, or seal with auto white-background removal.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-2">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-500 w-fit">
              <CheckCircle2 className="size-4" />
            </div>
            <h3 className="font-semibold text-sm">Adjust Text & Scale</h3>
            <p className="text-xs text-muted leading-relaxed">
              Scale text point size (10-44pt) and resize signatures from Small to Extra Large with live canvas updates.
            </p>
          </div>
        </div>

        {/* Recent PDF Documents Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted" />
              <h3 className="font-semibold text-sm text-foreground">Recent PDF Documents</h3>
            </div>
            <span className="text-xs text-muted">
              {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
            </span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted animate-pulse">
              Loading recent PDF files from Drive...
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface-2 p-8 text-center space-y-3">
              <FileText className="size-8 text-muted mx-auto opacity-50" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">No PDF files found in Drive</p>
                <p className="text-xs text-muted">
                  Upload a PDF above or click "Try Sample Agreement" to test the editor right away.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredFiles.map((file: any) => (
                <div
                  key={file.id}
                  onClick={() => handleOpenDrivePdf(file)}
                  className="group cursor-pointer rounded-xl border border-border bg-surface-2 p-4 flex items-center justify-between hover:border-red-500/60 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-lg bg-red-500/10 text-red-500 shrink-0 group-hover:bg-red-500 group-hover:text-white transition-colors">
                      <FileText className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium text-xs text-foreground block truncate group-hover:text-red-500 transition-colors">
                        {file.name}
                      </span>
                      <span className="text-[10px] text-muted block mt-0.5">
                        {file.size ? `${Math.round(file.size / 1024)} KB` : 'PDF Document'}
                      </span>
                    </div>
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500">
                      Open
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
