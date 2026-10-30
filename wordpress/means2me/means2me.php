<?php
/**
 * Plugin Name:       Means2Me
 * Plugin URI:        https://palmstroemen.github.io/bigNumbers/
 * Description:       Große Beträge im Text einordnen: pro Einwohner, pro Haushalt, als Anteil am Budget und im Vergleich mit anderen Zahlen. Die Werte werden beim Schreiben eingefroren; beim Lesen gibt es keine Anfrage an fremde Server.
 * Version:           0.1.0
 * Requires at least: 6.3
 * Requires PHP:      7.4
 * Author:            Oliver Rafelsberger
 * License:           MIT
 * License URI:       https://opensource.org/licenses/MIT
 * Text Domain:       means2me
 */

if (!defined('ABSPATH')) {
	exit;
}

const MEANS2ME_VERSION = '0.1.0';
const MEANS2ME_APP = 'https://palmstroemen.github.io/bigNumbers/app/';

/** Settings with their defaults: country of the readers, accent colour of the mark. */
function means2me_options() {
	return wp_parse_args(get_option('means2me', []), [
		'country' => 'AT',
		'accent'  => '',
	]);
}

/** Countries from the bundled data, for the settings page. */
function means2me_countries() {
	$file = __DIR__ . '/vendor/Daten/listen/mean2me.json';
	$data = is_readable($file) ? json_decode(file_get_contents($file), true) : null;
	$out  = [];
	foreach ($data['countries'] ?? [] as $c) {
		$out[$c['code']] = $c['flag'] . ' ' . $c['name'];
	}
	asort($out);
	return $out;
}

// --- Editor: a button in the text toolbar that marks the selected amount ---

add_action('enqueue_block_editor_assets', function () {
	$url = plugin_dir_url(__FILE__);
	wp_enqueue_script(
		'means2me-editor',
		$url . 'editor.js',
		['wp-rich-text', 'wp-block-editor', 'wp-components', 'wp-element', 'wp-data'],
		MEANS2ME_VERSION,
		true
	);
	$o = means2me_options();
	wp_add_inline_script('means2me-editor', 'window.means2meSettings = ' . wp_json_encode([
		'core'    => $url . 'vendor/core/index.js',
		'data'    => $url . 'vendor/Daten/',
		'country' => $o['country'],
	]) . ';', 'before');
	wp_enqueue_style('means2me-editor', $url . 'editor.css', ['wp-components'], MEANS2ME_VERSION);
});

// The editor canvas is an iframe; its marks get the same dotted underline as on the site.
add_action('enqueue_block_assets', function () {
	if (is_admin()) {
		wp_enqueue_style('means2me-canvas', plugin_dir_url(__FILE__) . 'canvas.css', [], MEANS2ME_VERSION);
	}
});

// --- Site: the small script that turns the marks into buttons, only where marks are ---

add_action('wp_enqueue_scripts', function () {
	wp_register_script(
		'means2me',
		plugin_dir_url(__FILE__) . 'vendor/embed/means2me.js',
		[],
		MEANS2ME_VERSION,
		['strategy' => 'defer', 'in_footer' => true]
	);
	$accent = means2me_options()['accent'];
	if ($accent) {
		wp_register_style('means2me', false, [], MEANS2ME_VERSION);
		wp_add_inline_style('means2me', ':root{--m2m-accent:' . $accent . '}');
	}
});

add_filter('the_content', function ($content) {
	if (strpos($content, 'data-means2me') !== false) {
		wp_enqueue_script('means2me');
		wp_enqueue_style('means2me');
	}
	return $content;
}, 20);

// "Rechenweg und Quellen" in the panel leads to the full app.
add_filter('script_loader_tag', function ($tag, $handle) {
	if ($handle !== 'means2me') {
		return $tag;
	}
	return str_replace(' src=', ' data-app="' . esc_url(MEANS2ME_APP) . '" src=', $tag);
}, 10, 2);

// --- Settings → Means2Me ---

add_action('admin_init', function () {
	register_setting('means2me', 'means2me', [
		'type'              => 'array',
		'sanitize_callback' => function ($in) {
			$countries = means2me_countries();
			return [
				'country' => isset($countries[$in['country'] ?? '']) ? $in['country'] : 'AT',
				'accent'  => sanitize_hex_color($in['accent'] ?? '') ?: '',
			];
		},
	]);
});

add_action('admin_menu', function () {
	add_options_page('Means2Me', 'Means2Me', 'manage_options', 'means2me', 'means2me_settings_page');
});

function means2me_settings_page() {
	$o = means2me_options();
	?>
	<div class="wrap">
		<h1>Means2Me</h1>
		<p>Im Block-Editor einen Betrag markieren, etwa „38 Mio. Euro“, und in der Werkzeugleiste des Absatzes auf das Means2Me-Zeichen tippen (Kreis mit zwei Zacken). Steht der Cursor in einem Betrag, genügt das auch ohne Markieren. Dort die Einordnungen auswählen, die beim Lesen erscheinen sollen.</p>
		<p>Die Werte werden beim Speichern fest in den Beitrag geschrieben. Ändern sich später Bevölkerungszahlen oder Budgets, bleibt der Text so, wie er freigegeben wurde.</p>
		<form method="post" action="options.php">
			<?php settings_fields('means2me'); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="means2me-country">Land der Leserinnen und Leser</label></th>
					<td>
						<select id="means2me-country" name="means2me[country]">
							<?php foreach (means2me_countries() as $code => $name) : ?>
								<option value="<?php echo esc_attr($code); ?>" <?php selected($o['country'], $code); ?>><?php echo esc_html($name); ?></option>
							<?php endforeach; ?>
						</select>
						<p class="description">Voreinstellung für neue Markierungen, im Editor pro Betrag änderbar.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="means2me-accent">Akzentfarbe</label></th>
					<td>
						<input id="means2me-accent" name="means2me[accent]" type="text" value="<?php echo esc_attr($o['accent']); ?>" placeholder="#2f5bea" pattern="#[0-9a-fA-F]{6}" class="regular-text">
						<p class="description">Farbe des Zeichens und der Links im Fenster, als #rrggbb. Leer lassen für Blau.</p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
	</div>
	<?php
}
