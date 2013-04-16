// Default if the datejs ajax call fails
var dateTimeFormat = "yyyy-MM-dd HH:mm";

(function()
{
    var datejs = "/yaft-tool/lib/datejs/date-" + sakai.locale.userLanguage + "-" + sakai.locale.userCountry + ".js";
    
    $.ajax({
        url: datejs,
        async: false,
        dataType: "script",
        success: function() {
            dateTimeFormat = Date.CultureInfo.formatPatterns.shortDate + " " + Date.CultureInfo.formatPatterns.shortTime;
        },
        error: function() {
            alert("datetime_locale: Unable to load translation for " + sakai.locale.userLanguage + "-" + sakai.locale.userCountry);
        }
    });

    function fetchDatepicker(locale) {
        var datepickerbase = "/yaft-tool/lib/jquery-ui/i18n/jquery.ui.datepicker-";
        var jsUrl = datepickerbase + locale.language;
        if (locale.country) {
            jsUrl += "-" + locale.country
        }
        jsUrl += ".js";
        
        $.ajax({
            url: jsUrl,
            dataType: "script",
            success: function() {},
            error: function() { 
                // Try without country code
                if (locale.country) {
                    fetchDatepicker({language: language});
                }
            }
        });
    }

    fetchDatepicker({language: sakai.locale.userLanguage, country: sakai.locale.userCountry});
    
}) ();