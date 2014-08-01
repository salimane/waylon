var ex = {

    config: {
        server: 'jenkins-foss',
        refresh_interval: 60
    },

    // Allow configuration to be passed-in from the erb template.
    init: function (settings) {
        'use strict';
        $.extend(ex.config, settings);
        $(document).ready(ex.setup());
    },

    setup: function() {
        'use strict';
        ex.refreshRadiator();

        var refreshInterval = ex.config.refresh_interval * 1000;
        setInterval(ex.refreshRadiator, refreshInterval);
    },

    refreshRadiator: function() {
        'use strict';

        var url = "/api/view/" + ex.config.view + "/server/" + ex.config.server + ".json";

        $('#loading').show();
        $.ajax({
            url: url,
            type: "GET",
            dataType: "json",

            success: function(json) {
                ex.buildJobs(json);
            },

            complete: function() {
                // This needs to be done after the elements have already loaded.
                // Therefore, it's safe to put it in ajaxComplete
                // ???
                $('[data-toggle="tooltip"]').tooltip({'placement': 'bottom'});
                $('#loading').hide();
            },
        });
    },

    buildJobs: function(json) {
        'use strict';
        $("#jobs").empty();

        $(document).ajaxStop(function() {
            ex.sortTable();
        });
        $.each(json.jobs, function(i, item) {
            var tr = $("<tr>").append(
                $("<td>").text(item),
                $("<td>").text("unknown")
            );
            tr.addClass("unknown-job");
            tr.attr("status", "unknown-job");
            $("#jobs").append(tr);

            ex.populateJob(ex.config.view, ex.config.server, item, tr);
        });
    },

    populateJob: function(view, server, job, e) {
        'use strict';
        var url = "/api/view/" + view + "/server/" + server + "/job/" + job + ".json";

        $.ajax({
            url: url,
            type: "GET",
            dataType: "json",
            success: function(json) {
                e.empty();

                var img = $("<img>");
                img.attr("class", "weather");
                img.attr("src", json["weather"]["src"]);
                img.attr("alt", json["weather"]["alt"]);
                img.attr("title", json["weather"]["title"]);

                var link = $("<a>").attr("href", json["url"]).text(job);

                var stat;
                switch(json["status"]) {
                    case "running":
                        stat = "building-job";
                        break;
                    case "failure":
                        stat = "failed-job";
                        break;
                    case "success":
                        stat = "successful-job";
                }


                e.append(
                    $("<td>").append(img, link),
                    $("<td>").text(json["status"])
                );

                if(stat) {
                    e.removeClass("unknown-job");
                    e.addClass(stat);
                    e.attr("status", stat);
                }
                ex.sortTable();
                ex.updateStatsRollup();
            }
        });
    },

    updateStatsRollup: function() {
        'use strict';

        var failed = 0, building = 0, unknown = 0, successful = 0;

        ex.eachJob(function(tr) {
            switch($(tr).attr("status")) {
                case "failed-job":
                    failed += 1;
                    break;
                case "building-job":
                    building += 1;
                    break;
                case "unknown-job":
                    unknown += 1;
                    break;
                case "successful-job":
                    successful += 1;
                    break;
            }
        });

        $("#successful-jobs").text(successful);
        $("#unknown-jobs").text(unknown);
        $("#building-jobs").text(building);
        $("#failed-jobs").text(failed);
        $("#total-jobs").text(failed + building + unknown + successful);
    },

    sortTable: function() {
        var children = $("#jobs tbody").children();

        children.sort(function(a, b) {
            var as = ex.sortValue($(a).attr("status"));
            var bs = ex.sortValue($(b).attr("status"));

            if (as > bs) {
                return -1;
            } else if (as < bs) {
                return 1;
            } else {
                return 0;
            }
        });

        children.detach().appendTo($("#jobs tbody"));
    },

    sortValue: function(x) {
        switch(x) {
            case "failed-job":
                return 3;
            case "building-job":
                return 2;
            case "unknown-job":
                return 1;
            case "successful-job":
                return 0;
            default:
                return -1;
        }
    },

    eachJob: function(callback) {
        'use strict';

        var children = $("#jobs tbody").children();

        $.each(children, function(i, elem) {
            callback(elem);
        });
    },
};
