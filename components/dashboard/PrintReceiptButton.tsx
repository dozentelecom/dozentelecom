"use client";

import { useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function PrintReceiptButton() {
  const [loading, setLoading] = useState<
    "image" | "pdf" | null
  >(null);

  function getReceiptElement() {
    const element =
      document.getElementById("receipt-content");

    if (!element) {
      throw new Error(
        "Receipt content could not be found."
      );
    }

    return element;
  }

  function getFileName(extension: string) {
    const reference =
      document
        .getElementById("receipt-reference")
        ?.textContent
        ?.trim()
        .replace(/[^a-zA-Z0-9_-]/g, "-") ||
      "receipt";

    return `Dozentelecom-${reference}.${extension}`;
  }

  async function createCanvas() {
    const element = getReceiptElement();

    /*
     * Temporarily remove anything marked as
     * data-receipt-hide from the captured receipt.
     */
    const hiddenElements =
      element.querySelectorAll(
        "[data-receipt-hide]"
      );

    hiddenElements.forEach((item) => {
      (item as HTMLElement).style.visibility =
        "hidden";
    });

    try {
      return await html2canvas(element, {
        scale: Math.min(
          2,
          window.devicePixelRatio || 1
        ),
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
    } finally {
      hiddenElements.forEach((item) => {
        (item as HTMLElement).style.visibility =
          "";
      });
    }
  }

  async function shareImage() {
    setLoading("image");

    try {
      const canvas = await createCanvas();

      const blob = await new Promise<Blob | null>(
        (resolve) =>
          canvas.toBlob(
            resolve,
            "image/png",
            1
          )
      );

      if (!blob) {
        throw new Error(
          "Unable to create receipt image."
        );
      }

      const file = new File(
        [blob],
        getFileName("png"),
        {
          type: "image/png",
        }
      );

      /*
       * Native phone share sheet.
       */
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({
          files: [file],
        })
      ) {
        await navigator.share({
          title: "Dozentelecom Receipt",
          text: "Dozentelecom transaction receipt",
          files: [file],
        });

        return;
      }

      /*
       * Browser fallback.
       */
      const url = URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download = file.name;
      link.click();

      URL.revokeObjectURL(url);

      alert(
        "Receipt image downloaded. You can now share it from your device."
      );
    } catch (error: any) {
      if (
        error?.name === "AbortError"
      ) {
        return;
      }

      console.error(
        "SHARE IMAGE ERROR:",
        error
      );

      alert(
        error?.message ||
          "Unable to create receipt image."
      );
    } finally {
      setLoading(null);
    }
  }

  async function sharePdf() {
    setLoading("pdf");

    try {
      const canvas = await createCanvas();

      const imgData =
        canvas.toDataURL(
          "image/png",
          1
        );

      /*
       * A4 PDF.
       */
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth =
        pdf.internal.pageSize.getWidth();

      const pageHeight =
        pdf.internal.pageSize.getHeight();

      const margin = 10;

      const usableWidth =
        pageWidth - margin * 2;

      const imageWidth =
        usableWidth;

      const imageHeight =
        (canvas.height * imageWidth) /
        canvas.width;

      /*
       * If receipt fits on one page.
       */
      if (
        imageHeight <=
        pageHeight - margin * 2
      ) {
        pdf.addImage(
          imgData,
          "PNG",
          margin,
          margin,
          imageWidth,
          imageHeight
        );
      } else {
        /*
         * Split a long receipt across
         * multiple PDF pages.
         */
        let remainingHeight =
          imageHeight;

        let position = margin;

        pdf.addImage(
          imgData,
          "PNG",
          margin,
          position,
          imageWidth,
          imageHeight
        );

        remainingHeight -=
          pageHeight - margin * 2;

        while (remainingHeight > 0) {
          pdf.addPage();

          position =
            margin -
            (imageHeight -
              remainingHeight);

          pdf.addImage(
            imgData,
            "PNG",
            margin,
            position,
            imageWidth,
            imageHeight
          );

          remainingHeight -=
            pageHeight - margin * 2;
        }
      }

      const pdfBlob =
        pdf.output("blob");

      const file = new File(
        [pdfBlob],
        getFileName("pdf"),
        {
          type: "application/pdf",
        }
      );

      /*
       * Native phone share sheet.
       */
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({
          files: [file],
        })
      ) {
        await navigator.share({
          title: "Dozentelecom Receipt",
          text: "Dozentelecom transaction receipt",
          files: [file],
        });

        return;
      }

      /*
       * Browser fallback.
       */
      const url =
        URL.createObjectURL(pdfBlob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download = file.name;
      link.click();

      URL.revokeObjectURL(url);

      alert(
        "Receipt PDF downloaded. You can now share it from your device."
      );
    } catch (error: any) {
      if (
        error?.name === "AbortError"
      ) {
        return;
      }

      console.error(
        "SHARE PDF ERROR:",
        error
      );

      alert(
        error?.message ||
          "Unable to create receipt PDF."
      );
    } finally {
      setLoading(null);
    }
  }

  function printReceipt() {
    window.print();
  }

  return (
    <div className="receipt-actions">
      <button
        type="button"
        className="receipt-action print"
        onClick={printReceipt}
        disabled={loading !== null}
      >
        🖨️ Print
      </button>

      <button
        type="button"
        className="receipt-action image"
        onClick={shareImage}
        disabled={loading !== null}
      >
        {loading === "image"
          ? "Creating image..."
          : "🖼️ Share as Image"}
      </button>

      <button
        type="button"
        className="receipt-action pdf"
        onClick={sharePdf}
        disabled={loading !== null}
      >
        {loading === "pdf"
          ? "Creating PDF..."
          : "📄 Share as PDF"}
      </button>

      <style jsx>{`
        .receipt-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .receipt-action {
          border: 0;
          border-radius: 9px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity .2s ease,
            transform .2s ease;
          white-space: nowrap;
        }

        .receipt-action:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .receipt-action:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .print {
          background: #e8eef5;
          color: #17324d;
        }

        .image {
          background: #e8f7ee;
          color: #166534;
        }

        .pdf {
          background: #feecec;
          color: #991b1b;
        }

        @media (max-width: 600px) {
          .receipt-actions {
            width: 100%;
          }

          .receipt-action {
            flex: 1 1 100%;
            width: 100%;
          }
        }

        @media print {
          .receipt-actions {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}