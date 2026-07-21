<?php
/**
 * Plugin Name:       LiveChat SaaS
 * Plugin URI:        https://your-livechat-saas.com
 * Description:       Add your LiveChat SaaS live chat widget to any WordPress site. Just paste your Widget Key.
 * Version:           1.0.0
 * Author:            LiveChat SaaS
 * License:           MIT
 * Text Domain:       livechat-saas
 */

if (!defined('ABSPATH')) {
    exit; // No direct access
}

define('LCSAAS_OPT_KEY', 'lcsaas_widget_key');
define('LCSAAS_OPT_API', 'lcsaas_api_base');
define('LCSAAS_DEFAULT_API', 'http://localhost:4000/api/v1');

/* -------------------------------------------------------------------------
 *  1. Output the widget script in the site footer (front-end)
 * ---------------------------------------------------------------------- */
function lcsaas_render_widget()
{
    $key = trim(get_option(LCSAAS_OPT_KEY, ''));
    if ($key === '') {
        return; // Not configured yet
    }
    $api = trim(get_option(LCSAAS_OPT_API, LCSAAS_DEFAULT_API));
    $api = rtrim($api, '/');
    $src = esc_url($api . '/widget.js');
    $key = esc_attr($key);
    echo "\n<!-- LiveChat SaaS widget -->\n";
    echo "<script async src=\"{$src}\" data-widget-key=\"{$key}\"></script>\n";
}
add_action('wp_footer', 'lcsaas_render_widget');

/* -------------------------------------------------------------------------
 *  2. Settings page under  Settings → LiveChat SaaS
 * ---------------------------------------------------------------------- */
function lcsaas_settings_menu()
{
    add_options_page(
        'LiveChat SaaS',
        'LiveChat SaaS',
        'manage_options',
        'livechat-saas',
        'lcsaas_settings_page'
    );
}
add_action('admin_menu', 'lcsaas_settings_menu');

function lcsaas_register_settings()
{
    register_setting('lcsaas', LCSAAS_OPT_KEY, ['sanitize_callback' => 'sanitize_text_field']);
    register_setting('lcsaas', LCSAAS_OPT_API, ['sanitize_callback' => 'esc_url_raw']);
}
add_action('admin_init', 'lcsaas_register_settings');

function lcsaas_settings_page()
{
    if (!current_user_can('manage_options')) {
        return;
    }
    $key = esc_attr(get_option(LCSAAS_OPT_KEY, ''));
    $api = esc_attr(get_option(LCSAAS_OPT_API, LCSAAS_DEFAULT_API));
    ?>
    <div class="wrap">
        <h1>💬 LiveChat SaaS</h1>
        <p>Add your live chat widget to this WordPress site. Find your <strong>Widget Key</strong> in your
           LiveChat SaaS dashboard → <em>Settings → Install</em>.</p>
        <form method="post" action="options.php">
            <?php settings_fields('lcsaas'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="lcsaas_key">Widget Key</label></th>
                    <td>
                        <input name="<?php echo LCSAAS_OPT_KEY; ?>" id="lcsaas_key" type="text"
                               value="<?php echo $key; ?>" class="regular-text" placeholder="lcw_XXXXXXXXXXXX" />
                        <p class="description">Example: <code>lcw_1h37gwUNN9VebHHv30ik8ITi</code></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="lcsaas_api">API URL</label></th>
                    <td>
                        <input name="<?php echo LCSAAS_OPT_API; ?>" id="lcsaas_api" type="url"
                               value="<?php echo $api; ?>" class="regular-text" />
                        <p class="description">Your LiveChat SaaS API base (e.g. <code>https://api.your-domain.com/api/v1</code>).</p>
                    </td>
                </tr>
            </table>
            <?php submit_button('Save & activate widget'); ?>
        </form>
        <?php if ($key !== '') : ?>
            <div class="notice notice-success inline"><p>✓ Widget is <strong>active</strong> on your site.</p></div>
        <?php endif; ?>
    </div>
    <?php
}

/* -------------------------------------------------------------------------
 *  3. "Settings" quick link on the Plugins page
 * ---------------------------------------------------------------------- */
function lcsaas_action_links($links)
{
    $url = admin_url('options-general.php?page=livechat-saas');
    array_unshift($links, '<a href="' . esc_url($url) . '">Settings</a>');
    return $links;
}
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'lcsaas_action_links');
