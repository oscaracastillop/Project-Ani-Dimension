package io.github.edo9300.edopro;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.provider.DocumentsContract;
import android.util.Log;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.documentfile.provider.DocumentFile;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;

import libwindbot.windbot.WindBot;

public class MainActivity extends Activity {
	private final static boolean wantsScopedStorage = Build.VERSION.SDK_INT > Build.VERSION_CODES.Q;

	private final static int PERMISSIONS = 1;
	private static final String[] REQUIRED_SDK_PERMISSIONS = new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE};
	private static String working_directory;
	private static String data_directory;
	private static boolean changelog;
	private static ArrayList<String> parameter;

	final int COPY_ASSETS = 1;
	final int CHOOSE_WORKING_DIR = 2;
	final int CHOOSE_DATA_DIR = 3;
	final int REAUTHORIZE_DATA_DIR = 4;

	@RequiresApi(Build.VERSION_CODES.R)
	private void showFileManager() {
		final var EXTERNAL_STORAGE_PROVIDER_AUTHORITY = "com.android.externalstorage.documents";
		final var DOCUMENT_ID_PRIMARY = "primary";
		final var DOCUMENT_ID_PRIMARY_ANDROID_DATA = "primary:Android/data/" + getApplicationContext().getPackageName() + "/files/EDOPro";
		final var TREE_URI_PRIMARY_ANDROID = DocumentsContract.buildTreeDocumentUri(EXTERNAL_STORAGE_PROVIDER_AUTHORITY, DOCUMENT_ID_PRIMARY);
		final var DOCUMENT_URI_ANDROID_DATA = DocumentsContract.buildDocumentUriUsingTree(TREE_URI_PRIMARY_ANDROID, DOCUMENT_ID_PRIMARY_ANDROID_DATA);

		final var EDOPRO_PROVIDER_AUTHORITY = getApplicationContext().getPackageName() + ".document_provider";
		final var extFiles = getExternalFilesDir(null);
		final var filePath = extFiles != null ? new File(extFiles, "EDOPro").getPath() : new File(getFilesDir(), "EDOPro").getPath();
		final var EDOPRO_TREE_URI_PRIMARY_ANDROID = DocumentsContract.buildTreeDocumentUri(EDOPRO_PROVIDER_AUTHORITY, filePath);
		final var EDOPRO_DOCUMENT_URI_ANDROID_DATA = DocumentsContract.buildDocumentUriUsingTree(EDOPRO_TREE_URI_PRIMARY_ANDROID, filePath);
		final var intents = Arrays.asList(new Intent()
						.setComponent(ComponentName.createRelative("com.google.android.documentsui", "com.android.documentsui.files.FilesActivity"))
						.setAction("android.intent.action.VIEW")
						.setData(EDOPRO_DOCUMENT_URI_ANDROID_DATA),
				new Intent().
						setComponent(ComponentName.createRelative("com.android.documentsui", ".files.FilesActivity"))
						.setAction("android.intent.action.VIEW")
						.setData(EDOPRO_DOCUMENT_URI_ANDROID_DATA),
				new Intent()
						.setComponent(ComponentName.createRelative("com.google.android.documentsui", "com.android.documentsui.files.FilesActivity"))
						.setAction("android.intent.action.VIEW")
						.setData(DOCUMENT_URI_ANDROID_DATA),
				new Intent().
						setComponent(ComponentName.createRelative("com.android.documentsui", ".files.FilesActivity"))
						.setAction("android.intent.action.VIEW")
						.setData(DOCUMENT_URI_ANDROID_DATA),
				new Intent("android.intent.action.VIEW")
						.setData(Uri.parse("content://com.android.externalstorage.documents/root/primary"))
		);

		for (final var intent : intents) {
			try {
				startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION));
				new Handler().postDelayed(this::finishAndRemoveTask, 600L);
				return;
			} catch (Exception ignored) {
			}
		}
		this.finishAndRemoveTask();
	}

	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		var intent = getIntent();
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
			var extras = this.getIntent().getExtras();
			if (extras != null) {
				var manageString = extras.getString("manageFiles");
				if ("yes".equals(manageString)) {
					showFileManager();
					return;
				}
			}
		}
		parameter = new ArrayList<>();
		if (intent.getAction() != null
				&& intent.getAction().equals(Intent.ACTION_VIEW)) {
			Log.e("Edopro open file", "aa");
			if (!isTaskRoot()) {
				Log.e("Edopro open file", "bb");
				/* TODO: Send drop event */
				finish();
				return;
			}
			Uri data = intent.getData();
			if (data != null) {
				intent.setData(null);
				try {
					Log.e("Edopro", data.getPath());
					var path = FileUtil.getFullPathFromTreeUri(data, this);
					parameter.add(path);
					Log.e("Edopro", "parsed path: " + parameter);
				} catch (Exception e) {
					var path = data.getPath();
					parameter.add(path);
					Log.e("Edopro", "It was already a path: " + data.getPath());
				}
			}
		}
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
			if (wantsScopedStorage) {
				// we skip the permissions check as we need none
				getWorkingDirectory();
			} else {
				checkPermission();
			}
		} else {
			getWorkingDirectory();
		}
	}

	protected void checkPermission() {
		final List<String> missingPermissions = new ArrayList<>();
		// check required permission
		for (final String permission : REQUIRED_SDK_PERMISSIONS) {
			final var result = ContextCompat.checkSelfPermission(this, permission);
			if (result != PackageManager.PERMISSION_GRANTED) {
				missingPermissions.add(permission);
			}
		}
		if (!missingPermissions.isEmpty()) {
			// request permission
			final var permissions = missingPermissions.toArray(new String[0]);
			ActivityCompat.requestPermissions(this, permissions, PERMISSIONS);
		} else {
			final var grantResults = new int[REQUIRED_SDK_PERMISSIONS.length];
			Arrays.fill(grantResults, PackageManager.PERMISSION_GRANTED);
			onRequestPermissionsResult(PERMISSIONS, REQUIRED_SDK_PERMISSIONS,
					grantResults);
		}
	}

	@Override
	public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
										   @NonNull int[] grantResults) {
		getWorkingDirectory();
	}

	private static void deleteRecursive(File fileOrDirectory) {
		if (fileOrDirectory.isDirectory())
			for (File child : Objects.requireNonNull(fileOrDirectory.listFiles()))
				deleteRecursive(child);

		fileOrDirectory.delete();
	}

	@SuppressWarnings("ResultOfMethodCallIgnored")
	protected void onActivityResult(int requestCode, int resultCode, Intent data) {
		switch (requestCode) {
			case COPY_ASSETS: {
				try {
					var file = new File(getFilesDir(), "assets_copied");
					if (file.exists() || file.createNewFile()) {
						var wr = new FileWriter(file);
						wr.write("" + BuildConfig.VERSION_CODE);
						wr.flush();
					}
					if (wantsScopedStorage && data_directory != null && !data_directory.isEmpty()) {
						var decksFolder = new File(working_directory, "deck");
						if (decksFolder.isDirectory()) {
							var storage = new StorageOperations(this, data_directory);
							String dest_deck_dir = data_directory + "/deck";
							if (storage.contentUriCreateDirectory(dest_deck_dir)) {
								for (var child : Objects.requireNonNull(decksFolder.listFiles())) {
									storage.contentUriCopyFile(child, dest_deck_dir);
								}
							}
							deleteRecursive(decksFolder);
						}
					}
				} catch (Exception e) {
					Log.e("EDOPro", "error when creating assets_copied file: " + e.getMessage());
				}
				next();
				break;
			}
			case CHOOSE_WORKING_DIR: {
				if (resultCode == Activity.RESULT_CANCELED) {
					break;
				}
				if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
					return;
				}
				var uri = data.getData();
				Log.i("EDOPro", "Result URI " + uri);
				var dest_dir = FileUtil.getFullPathFromTreeUri(uri, this);
				if (dest_dir == null) {
					Log.e("EDOPro", "returned URI is null");
					finish();
					break;
				}
				Log.i("EDOPro", "Parsed result URI " + dest_dir);
				if (dest_dir.startsWith("/storage/emulated/0"))
					setWorkingDir(dest_dir);
				else {
					var paths = getExternalFilesDirs("EDOPro");
					var dirs = dest_dir.split("/");
					var found = false;
					if (dirs.length > 2) {
						String storage = dirs[2];
						for (int i = 0; i < paths.length; i++) {
							Log.i("EDOPro", "Path " + i + " is: " + paths[i]);
							if (storage.equals(paths[i].getAbsolutePath().split("/")[2])) {
								Log.i("EDOPro", "path matching with " + dest_dir + " is: " + paths[i].getAbsolutePath());
								dest_dir = paths[i].getAbsolutePath();
								if (!paths[i].exists()) {
									paths[i].mkdirs();
								}
								found = true;
								break;
							}
						}
					}
					if (found) {
						Toast.makeText(this, String.format(getResources().getString(R.string.default_dir), dest_dir), Toast.LENGTH_LONG).show();
						final var cbdir = dest_dir;
						new AlertDialog.Builder(this)
								.setMessage(String.format(getResources().getString(R.string.default_path), dest_dir))
								.setCancelable(false)
								.setPositiveButton("OK", new DialogInterface.OnClickListener() {
									public void onClick(DialogInterface dialog, int id) {
										setWorkingDir(cbdir);
									}
								})
								.create().show();
					} else {
						Toast.makeText(this, getResources().getString(R.string.no_matching), Toast.LENGTH_LONG).show();
						Log.e("EDOPro", "couldn't find matching storage");
						finish();
					}
				}
				break;
			}
			case REAUTHORIZE_DATA_DIR:
			case CHOOSE_DATA_DIR: {
				if (!wantsScopedStorage) {
					return;
				}
				if (resultCode == Activity.RESULT_CANCELED) {
					break;
				}

				var uri = data.getData();

				getContentResolver().takePersistableUriPermission(
						uri,
						Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
				);

				Log.i("EDOPro", "Result URI " + uri);
				Log.i("EDOPro", "Parsed result URI " + DocumentFile.fromTreeUri(this, uri).getUri());
				setWorkingDir(working_directory, DocumentFile.fromTreeUri(this, uri).getUri().toString());
				break;
			}
		}
	}

	public void next() {
		ensureEssentialAssets(working_directory);
		var use_windbot = true;
		if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.ICE_CREAM_SANDWICH_MR1) {
			use_windbot = false;
		} else {
			try {
				/*
				 * windbot loading might fail, for whatever reason,
				 * disable it if that's the case
				 */
				WindBot.initAndroid(working_directory + "/WindBot");
			} catch (Throwable e) {
				use_windbot = false;
			}
		}
		/*
			pass the working directory via parameters, rather than making
			the app read the working_dir file
		*/
		if (changelog)
			parameter.add(0, "-l");
		parameter.add(0, working_directory + "/");
		parameter.add(0, "-C");
		if (data_directory != null && !data_directory.isEmpty()) {
			parameter.add(0, data_directory);
			parameter.add(0, "-U");
		}
		var array = parameter.toArray();
		var strArr = new String[array.length];
		for (int i = 0; i < array.length; i++) {
			strArr[i] = array[i].toString();
		}
		var intent = new Intent(this, EpNativeActivity.class);
		intent.putExtra("ARGUMENTS", strArr);
		intent.putExtra("USE_WINDBOT", use_windbot);
		intent.putExtra("SCOPED_STORAGE_DIR", data_directory);
		intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_CLEAR_TASK);
		startActivity(intent);
	}

	public void getWorkingDirectory() {
		var file = new File(getFilesDir(), "working_dir");
		if (file.exists()) {
			try {
				BufferedReader br = new BufferedReader(new FileReader(file));
				working_directory = br.readLine();
				br.close();
			} catch (IOException e) {
				Log.e("EDOPro", "working directory file found but not read: " + e.getMessage());
			}
		}
		file = new File(getFilesDir(), "data_dir");
		if (file.exists()) {
			try {
				BufferedReader br = new BufferedReader(new FileReader(file));
				data_directory = br.readLine();
				br.close();
			} catch (IOException e) {
				Log.e("EDOPro", "working directory file found but not read: " + e.getMessage());
			}
		}

		if (wantsScopedStorage && data_directory != null) {
			var storage = new StorageOperations(this, data_directory);
			if (!storage.hasAccess()) {
				reauthorizeDataDir();
				return;
			}
		}

		if (working_directory != null) {
			copyAssetsPrompt(working_directory);
			return;
		}
		getDefaultPath();
	}

	public void getDefaultPath() {
		final File path;
		if (wantsScopedStorage) {
			File ext = getExternalFilesDir(null);
			if (ext == null) {
				ext = getFilesDir();
			}
			path = new File(ext, "EDOPro");
		} else {
			path = new File(Environment.getExternalStorageDirectory() + "/EDOPro");
		}
		if (!path.exists()) {
			path.mkdirs();
		}
		final String dest_dir = path.getAbsolutePath();
		setWorkingDir(dest_dir);
	}

	@RequiresApi(Build.VERSION_CODES.LOLLIPOP)
	public void chooseWorkingDir() {
		var i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
		if (android.os.Build.VERSION.SDK_INT >= 26) {
			var suggestedPath = Environment.getExternalStorageDirectory().getPath() + "/EDOPro";
			Log.d("EDOPro", suggestedPath);
			i.putExtra(DocumentsContract.EXTRA_INITIAL_URI, Uri.parse(suggestedPath));
		}
		i.addCategory(Intent.CATEGORY_DEFAULT);
		i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
		i.addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
		i.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);  // not yet used properly
		i.putExtra(Intent.EXTRA_LOCAL_ONLY, true);  // Only allow local folders.
		startActivityForResult(Intent.createChooser(i, "Choose directory"), CHOOSE_WORKING_DIR);
	}

	@RequiresApi(Build.VERSION_CODES.R)
	public void chooseDataDir(String base_dir) {
		var i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
		var suggestedPath = Environment.getExternalStorageDirectory().getPath() + "/EDOPro";
		Log.d("EDOPro", suggestedPath);
		i.putExtra(DocumentsContract.EXTRA_INITIAL_URI, Uri.parse(suggestedPath));
		i.addCategory(Intent.CATEGORY_DEFAULT);
		i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
		i.addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
		i.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);  // not yet used properly
		i.putExtra(Intent.EXTRA_LOCAL_ONLY, true);  // Only allow local folders.
		working_directory = base_dir;
		startActivityForResult(Intent.createChooser(i, "Choose directory"), CHOOSE_DATA_DIR);
	}

	@RequiresApi(Build.VERSION_CODES.R)
	public void reauthorizeDataDir() {
		AlertDialog.Builder builder = new AlertDialog.Builder(this);
		builder.setMessage(getResources().getString(R.string.reconfirm_data_dir))
				.setCancelable(false)
				.setPositiveButton("OK", (dialog, id) -> {
					var i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
					var suggestedPath = Environment.getExternalStorageDirectory().getPath() + "/EDOPro";
					Log.d("EDOPro", suggestedPath);
					i.putExtra(DocumentsContract.EXTRA_INITIAL_URI, Uri.parse(data_directory));
					i.addCategory(Intent.CATEGORY_DEFAULT);
					i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
					i.addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
					i.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);  // not yet used properly
					i.putExtra(Intent.EXTRA_LOCAL_ONLY, true);  // Only allow local folders.
					startActivityForResult(Intent.createChooser(i, "Choose directory"), REAUTHORIZE_DATA_DIR);
				});

		AlertDialog alert = builder.create();
		alert.show();
	}

	public void setWorkingDir(String dest_dir, String data_dir) {
		{
			working_directory = dest_dir;
			var file = new File(getFilesDir(), "working_dir");
			try {
				var fOut = new FileOutputStream(file);
				new OutputStreamWriter(fOut).append(dest_dir).close();
				fOut.close();
			} catch (Exception e) {
				Log.e("EDOPro", "cannot write to working directory file: " + e.getMessage());
				finish();
				return;
			}
		}
		if (data_dir != null && !data_dir.equals(data_directory)) {
			data_directory = data_dir;
			var file = new File(getFilesDir(), "data_dir");
			try {
				var fOut = new FileOutputStream(file);
				new OutputStreamWriter(fOut).append(data_dir).close();
				fOut.close();
			} catch (Exception e) {
				Log.e("EDOPro", "cannot write to working directory file: " + e.getMessage());
				finish();
				return;
			}
		}
		copyAssetsPrompt(dest_dir);
	}

	public void setWorkingDir(String dest_dir) {
		setWorkingDir(dest_dir, null);
	}

	public void copyAssetsPrompt(final String working_dir) {
		changelog = false;
		var file = new File(getFilesDir(), "assets_copied");
		var cover1 = new File(working_dir, "textures/cover.jpg");
		var cover2 = new File(working_dir, "textures/cover.png");
		boolean texturesExist = cover1.exists() || cover2.exists();

		if (file.exists() && texturesExist) {
			try {
				var fileReader = new BufferedReader(new FileReader(file));
				var line = fileReader.readLine();
				int prevversion = Integer.parseInt(line);
				if (prevversion < BuildConfig.VERSION_CODE) {
					try {
						copyCertificate();
						//creates the empty assets_copied file
						new PrintWriter(file).close();
						Toast.makeText(this, getResources().getString(R.string.copying_update), Toast.LENGTH_LONG).show();
						copyAssets(working_dir, false);
					} catch (Exception ignored) {
					}
				} else
					next();
				return;
			} catch (Exception ignored) {
			}
		}
		copyCertificate();
		copyAssets(working_dir, false);
	}

	public void copyCertificate() {
		try {
			var certout = new File(getFilesDir(), "cacert.pem");
			if (certout.exists()) {
				Log.i("EDOPro", "Certificate file already copied");
			} else {
				var certin = getAssets().open("cacert.pem");
				try {
					var fOut = new FileOutputStream(certout);
					var buffer = new byte[1024];
					int length;
					while ((length = certin.read(buffer)) > 0) {
						fOut.write(buffer, 0, length);
					}
					fOut.close();
				} catch (Exception e) {
					Log.e("EDOPro", "cannot copy certificate file: " + e.getMessage());
				}
			}
		} catch (IOException e) {
			e.printStackTrace();
		}
	}

	public void ensureEssentialAssets(String working_dir) {
		if (working_dir == null || working_dir.isEmpty()) return;
		try {
			File texturesDir = new File(working_dir, "textures");
			if (!texturesDir.exists()) texturesDir.mkdirs();

			String[] assetFolders = new String[]{"defaults/textures", "textures"};
			for (String folder : assetFolders) {
				try {
					String[] list = getAssets().list(folder);
					if (list != null) {
						for (String file : list) {
							File destFile = new File(texturesDir, file);
							if (!destFile.exists() || destFile.length() == 0) {
								try (InputStream in = getAssets().open(folder + "/" + file);
									 FileOutputStream out = new FileOutputStream(destFile)) {
									byte[] buffer = new byte[8192];
									int read;
									while ((read = in.read(buffer)) != -1) {
										out.write(buffer, 0, read);
									}
									out.flush();
								} catch (Exception ignored) {
								}
							}
						}
					}
				} catch (Exception ignored) {
				}
			}

			File configDir = new File(working_dir, "config");
			if (!configDir.exists()) configDir.mkdirs();
			String[] configFolders = new String[]{"defaults/config", "config"};
			for (String folder : configFolders) {
				try {
					String[] list = getAssets().list(folder);
					if (list != null) {
						for (String file : list) {
							File destFile = new File(configDir, file);
							if (!destFile.exists() || destFile.length() == 0) {
								try (InputStream in = getAssets().open(folder + "/" + file);
									 FileOutputStream out = new FileOutputStream(destFile)) {
									byte[] buffer = new byte[8192];
									int read;
									while ((read = in.read(buffer)) != -1) {
										out.write(buffer, 0, read);
									}
									out.flush();
								} catch (Exception ignored) {
								}
							}
						}
					}
				} catch (Exception ignored) {
				}
			}
		} catch (Exception e) {
			Log.e("EDOPro", "Error ensuring essential assets: " + e.getMessage());
		}
	}

	public void copyAssets(String working_dir, boolean isUpdate) {
		changelog = true;
		Intent intent = new Intent(this, AssetCopy.class);
		var params = new Bundle();
		params.putString("workingDir", working_dir);
		params.putBoolean("isUpdate", isUpdate);
		intent.putExtras(params);
		startActivityForResult(intent, COPY_ASSETS);
	}
}
