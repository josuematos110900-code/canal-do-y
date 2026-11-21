package com.ketshop.activities;

import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.View;
import android.view.animation.AnimationUtils;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.PopupMenu;
import android.widget.ProgressBar;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.models.Order;
import com.ketshop.models.PaymentMethod;
import com.ketshop.network.Async;
import com.ketshop.repositories.OrderRepository;
import com.ketshop.repositories.ProofRepository;
import com.ketshop.utils.Formatters;
import com.ketshop.utils.ImageUtils;
import com.ketshop.utils.ProofFileProvider;
import com.ketshop.utils.StateView;
import com.ketshop.utils.UiUtils;

import java.io.File;

/**
 * Envio do comprovativo de pagamento:
 * galeria ou câmara -> pré-visualização -> validação (MIME pelos bytes,
 * tamanho) -> upload com progresso para o Storage privado -> registo via RPC.
 */
public class ProofUploadActivity extends BaseActivity {

    public static final String EXTRA_ORDER_ID = "order_id";

    private static final int REQ_GALLERY = 701;
    private static final int REQ_CAMERA = 702;
    private static final String S_URI = "selected_uri";
    private static final String S_CAMERA = "camera_file";
    private static final String S_UPLOADED = "uploaded_path";

    private String orderId;
    private Order order;
    private Uri selectedUri;
    private File cameraFile;
    private ImageUtils.PreparedImage prepared;
    /** Caminho já carregado no Storage (permite repetir só o registo se este falhar). */
    private String uploadedPath;
    private boolean uploading;

    private StateView state;
    private ImageView preview;
    private View placeholder, removeBtn, replaceBtn, sourceButtons, progressBox, preparing, form, success, bottom;
    private ProgressBar progress;
    private TextView progressText, fileInfo, error;
    private Button submit;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!requireSession()) return;
        orderId = getIntent().getStringExtra(EXTRA_ORDER_ID);
        if (orderId == null) { finish(); return; }
        setContentView(R.layout.activity_proof_upload);
        setupToolbar(getString(R.string.proof_toolbar), true);
        bindViews();

        if (savedInstanceState != null) {
            String u = savedInstanceState.getString(S_URI);
            String c = savedInstanceState.getString(S_CAMERA);
            uploadedPath = savedInstanceState.getString(S_UPLOADED);
            if (c != null) cameraFile = new File(c);
            if (u != null) prepare(Uri.parse(u), cameraFile);
        }
        loadOrder();
    }

    private void bindViews() {
        state = new StateView(this, findViewById(R.id.proof_scroll), this::loadOrder);
        preview = findViewById(R.id.proof_preview);
        placeholder = findViewById(R.id.proof_placeholder);
        removeBtn = findViewById(R.id.proof_remove);
        replaceBtn = findViewById(R.id.proof_replace);
        sourceButtons = findViewById(R.id.proof_source_buttons);
        progressBox = findViewById(R.id.proof_progress_box);
        progress = findViewById(R.id.proof_progress);
        progressText = findViewById(R.id.proof_progress_text);
        preparing = findViewById(R.id.proof_preparing);
        fileInfo = findViewById(R.id.proof_file_info);
        error = findViewById(R.id.proof_error);
        submit = findViewById(R.id.proof_submit);
        form = findViewById(R.id.proof_form);
        success = findViewById(R.id.proof_success);
        bottom = findViewById(R.id.proof_bottom);

        findViewById(R.id.proof_gallery).setOnClickListener(v -> openGallery());
        findViewById(R.id.proof_camera).setOnClickListener(v -> openCamera());
        findViewById(R.id.proof_preview_box).setOnClickListener(v -> {
            if (prepared == null && !uploading) chooseSource(v);
        });
        replaceBtn.setOnClickListener(v -> { if (!uploading) chooseSource(v); });
        removeBtn.setOnClickListener(v -> { if (!uploading) clearImage(); });
        submit.setOnClickListener(v -> confirmSubmit());
        findViewById(R.id.proof_success_track).setOnClickListener(v -> {
            Intent i = new Intent(this, OrderTrackingActivity.class);
            i.putExtra(OrderTrackingActivity.EXTRA_ORDER_ID, orderId);
            startActivity(i);
            finish();
        });
        findViewById(R.id.proof_success_home).setOnClickListener(v -> {
            Intent i = new Intent(this, HomeActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(i);
            finish();
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (selectedUri != null) out.putString(S_URI, selectedUri.toString());
        if (cameraFile != null) out.putString(S_CAMERA, cameraFile.getAbsolutePath());
        if (uploadedPath != null) out.putString(S_UPLOADED, uploadedPath);
    }

    @Override
    public void onBackPressed() {
        if (uploading) {
            UiUtils.toast(this, getString(R.string.proof_wait_upload));
            return;
        }
        super.onBackPressed();
    }

    // ------------------------------------------------------------ Encomenda

    private void loadOrder() {
        state.loading();
        call(() -> OrderRepository.get(orderId), o -> {
            order = o;
            if (!o.status.acceptsProof()) {
                state.empty(getString(R.string.proof_not_accepted, o.status.label));
                bottom.setVisibility(View.GONE);
                return;
            }
            if (o.paymentMethodId == null) {
                UiUtils.toast(this, getString(R.string.proof_choose_method_first));
                Intent i = new Intent(this, PaymentActivity.class);
                i.putExtra(PaymentActivity.EXTRA_ORDER_ID, orderId);
                startActivity(i);
                finish();
                return;
            }
            state.content();
            ((TextView) findViewById(R.id.proof_order_code)).setText(o.orderCode);
            PaymentMethod pm = o.paymentMethod();
            ((TextView) findViewById(R.id.proof_order_info)).setText(o.productTitle() + " · "
                    + Formatters.kz(o.totalKz) + (pm != null ? "\n" + pm.name : ""));
            TextView rejected = findViewById(R.id.proof_rejected);
            if (o.rejectionReason != null && o.status == com.ketshop.models.OrderStatus.PAYMENT_REJECTED) {
                rejected.setVisibility(View.VISIBLE);
                rejected.setText(getString(R.string.proof_previous_rejected, o.rejectionReason));
            }
        }, e -> state.error(e.getMessage()));
    }

    // -------------------------------------------------------- Origem da imagem

    private void chooseSource(View anchor) {
        PopupMenu menu = new PopupMenu(this, anchor);
        menu.getMenuInflater().inflate(R.menu.menu_proof_source, menu.getMenu());
        menu.setOnMenuItemClickListener(item -> {
            if (item.getItemId() == R.id.action_pick_gallery) openGallery();
            else if (item.getItemId() == R.id.action_take_photo) openCamera();
            return true;
        });
        menu.show();
    }

    private void openGallery() {
        if (uploading) return;
        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
        i.setType("image/*");
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/jpeg", "image/png", "image/webp"});
        try {
            startActivityForResult(Intent.createChooser(i, getString(R.string.proof_from_gallery)), REQ_GALLERY);
        } catch (ActivityNotFoundException e) {
            UiUtils.toast(this, getString(R.string.proof_no_gallery));
        }
    }

    /**
     * Usa a app de câmara do sistema (ACTION_IMAGE_CAPTURE). Não é necessária a
     * permissão CAMERA porque a app não acede directamente ao hardware.
     */
    private void openCamera() {
        if (uploading) return;
        cameraFile = new File(ProofFileProvider.proofDir(this), "foto_" + System.currentTimeMillis() + ".jpg");
        Uri out = ProofFileProvider.uriFor(cameraFile);
        Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        i.putExtra(MediaStore.EXTRA_OUTPUT, out);
        i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        i.setClipData(ClipData.newRawUri("", out));
        try {
            startActivityForResult(i, REQ_CAMERA);
        } catch (ActivityNotFoundException | SecurityException e) {
            cameraFile = null;
            UiUtils.toast(this, getString(R.string.proof_no_camera));
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK) {
            if (requestCode == REQ_CAMERA && cameraFile != null && cameraFile.length() == 0) {
                cameraFile.delete();
                cameraFile = null;
            }
            return;
        }
        if (requestCode == REQ_GALLERY && data != null && data.getData() != null) {
            cameraFile = null;
            prepare(data.getData(), null);
        } else if (requestCode == REQ_CAMERA && cameraFile != null) {
            if (cameraFile.length() == 0) {
                UiUtils.toast(this, getString(R.string.proof_camera_empty));
                return;
            }
            prepare(ProofFileProvider.uriFor(cameraFile), cameraFile);
        }
    }

    // ------------------------------------------------- Validação e pré-visualização

    private void prepare(final Uri uri, final File localFile) {
        error.setVisibility(View.GONE);
        preparing.setVisibility(View.VISIBLE);
        submit.setEnabled(false);
        call(() -> ImageUtils.prepare(getApplicationContext(), uri, localFile), img -> {
            preparing.setVisibility(View.GONE);
            selectedUri = uri;
            prepared = img;
            uploadedPath = null; // nova imagem -> novo upload
            showPreview();
        }, e -> {
            preparing.setVisibility(View.GONE);
            showError(e.getMessage());
        });
    }

    private void showPreview() {
        placeholder.setVisibility(View.GONE);
        preview.setVisibility(View.VISIBLE);
        preview.setImageBitmap(prepared.preview);
        preview.startAnimation(AnimationUtils.loadAnimation(this, R.anim.fade_in));
        removeBtn.setVisibility(View.VISIBLE);
        replaceBtn.setVisibility(View.VISIBLE);
        sourceButtons.setVisibility(View.GONE);
        fileInfo.setVisibility(View.VISIBLE);
        fileInfo.setText(prepared.fileName + " · " + prepared.extension.toUpperCase() + " · "
                + Formatters.bytes(prepared.bytes.length));
        submit.setEnabled(true);
    }

    private void clearImage() {
        prepared = null;
        selectedUri = null;
        uploadedPath = null;
        if (cameraFile != null) {
            cameraFile.delete();
            cameraFile = null;
        }
        preview.setImageDrawable(null);
        preview.setVisibility(View.GONE);
        placeholder.setVisibility(View.VISIBLE);
        removeBtn.setVisibility(View.GONE);
        replaceBtn.setVisibility(View.GONE);
        sourceButtons.setVisibility(View.VISIBLE);
        fileInfo.setVisibility(View.GONE);
        error.setVisibility(View.GONE);
        submit.setEnabled(false);
    }

    // -------------------------------------------------------------- Envio

    private void confirmSubmit() {
        if (prepared == null || order == null || uploading) return;
        new AlertDialog.Builder(this)
                .setTitle(R.string.proof_confirm_title)
                .setMessage(getString(R.string.proof_confirm_message, order.orderCode, Formatters.kz(order.totalKz)))
                .setPositiveButton(R.string.proof_submit, (d, w) -> upload())
                .setNegativeButton(R.string.action_cancel, null)
                .show();
    }

    private void upload() {
        uploading = true;
        error.setVisibility(View.GONE);
        submit.setEnabled(false);
        submit.setText(R.string.proof_uploading);
        removeBtn.setVisibility(View.GONE);
        replaceBtn.setEnabled(false);
        progressBox.setVisibility(View.VISIBLE);
        progress.setProgress(0);
        progressText.setText(getString(R.string.proof_progress, 0));
        final ImageUtils.PreparedImage img = prepared;
        final String alreadyUploaded = uploadedPath;

        call(() -> {
            String path = alreadyUploaded;
            if (path == null) {
                path = ProofRepository.upload(orderId, img, (sent, total) -> {
                    final int pct = (int) (sent * 95 / Math.max(1, total));
                    Async.main(() -> {
                        progress.setProgress(pct);
                        progressText.setText(getString(R.string.proof_progress, pct));
                    });
                });
                final String p = path;
                Async.main(() -> uploadedPath = p);
            }
            Async.main(() -> progressText.setText(R.string.proof_registering));
            ProofRepository.submit(orderId, path, img);
            return path;
        }, path -> {
            uploading = false;
            progress.setProgress(100);
            showSuccess();
        }, e -> {
            uploading = false;
            progressBox.setVisibility(View.GONE);
            replaceBtn.setEnabled(true);
            removeBtn.setVisibility(View.VISIBLE);
            submit.setEnabled(true);
            submit.setText(uploadedPath != null ? R.string.proof_retry_register : R.string.proof_submit);
            showError(e.getMessage());
        });
    }

    private void showSuccess() {
        if (cameraFile != null) cameraFile.delete();
        form.setVisibility(View.GONE);
        bottom.setVisibility(View.GONE);
        success.setVisibility(View.VISIBLE);
        ((TextView) findViewById(R.id.proof_success_text)).setText(getString(R.string.proof_success_text, order.orderCode));
        findViewById(R.id.proof_success_icon).startAnimation(AnimationUtils.loadAnimation(this, R.anim.logo_enter));
    }

    private void showError(String msg) {
        error.setVisibility(View.VISIBLE);
        error.setText(msg);
        UiUtils.shake(error);
    }
}
