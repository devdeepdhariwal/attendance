export default function StepUpload({ template, templateURL, templateSize, onUpload, onNext }) {
  return (
    <div className="bg-white rounded-2xl shadow p-8 max-w-xl">
      <h2 className="text-lg font-semibold text-slate-800 mb-1">Upload Certificate Template</h2>
      <p className="text-slate-400 text-sm mb-5">
        Upload your certificate image (PNG or JPG). Leave the name and serial number areas blank.
      </p>

      <label className="block w-full cursor-pointer border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-10 text-center transition-colors group">
        <input type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={onUpload} />
        <div className="text-4xl mb-3">📄</div>
        {template
          ? <>
              <p className="text-indigo-600 font-semibold">{template.name}</p>
              <p className="text-slate-400 text-xs mt-1">{templateSize.w} × {templateSize.h}px</p>
            </>
          : <p className="text-slate-400 text-sm group-hover:text-indigo-500">Click to upload PNG / JPG</p>
        }
      </label>

      {template && (
        <>
          <img src={templateURL} alt="Template preview" className="mt-4 w-full rounded-xl border border-slate-200" />
          <button onClick={onNext}
            className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
            Next: Position Text →
          </button>
        </>
      )}
    </div>
  );
}
